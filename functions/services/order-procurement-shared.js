import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { toNonNegativeInt } from './purchase-order-projection.js';

export { buildOrderLineProjectionStatement, queryInventoryBalance } from './order-line-shared.js';

const DEFAULT_PURCHASE_ORDER_ITEM_SELECT =
  'id, po_id, product_id, variant_id, pre_order_id, quantity, received_qty, cancelled_qty';

function normalizeFingerprintItemId(value) {
  return String(value || '').trim();
}

function sortFingerprintItems(items = [], compare) {
  return [...items].sort(compare);
}

export function parseStoredResponse(responseJson) {
  if (!responseJson) return null;
  try {
    return JSON.parse(responseJson);
  } catch {
    return null;
  }
}

export function buildReceiptRequestFingerprint(poId, payload = {}) {
  const normalizedItems = sortFingerprintItems(
    (Array.isArray(payload.items) ? payload.items : []).map((entry = {}) => ({
      purchase_order_item_id: normalizeFingerprintItemId(entry.purchase_order_item_id),
      received_qty: toNonNegativeInt(entry.received_qty),
      note: entry.note == null ? null : String(entry.note),
    })),
    (left, right) => {
      const key = left.purchase_order_item_id.localeCompare(right.purchase_order_item_id);
      if (key !== 0) return key;
      const qty = left.received_qty - right.received_qty;
      if (qty !== 0) return qty;
      return String(left.note || '').localeCompare(String(right.note || ''));
    }
  );

  return JSON.stringify({
    purchase_order_id: poId,
    items: normalizedItems,
  });
}

export function buildReversalRequestFingerprint(poId, receiptId, payload = {}) {
  return JSON.stringify({
    purchase_order_id: poId,
    receipt_id: receiptId,
    reason: payload.reason || null,
  });
}

export function buildShortageClosureRequestFingerprint(poId, payload = {}) {
  const normalizedItems = sortFingerprintItems(
    (Array.isArray(payload.items) ? payload.items : []).map((entry = {}) => ({
      purchase_order_item_id: normalizeFingerprintItemId(entry.purchase_order_item_id),
      close_qty: toNonNegativeInt(entry.close_qty),
    })),
    (left, right) => {
      const key = left.purchase_order_item_id.localeCompare(right.purchase_order_item_id);
      if (key !== 0) return key;
      return left.close_qty - right.close_qty;
    }
  );

  return JSON.stringify({
    purchase_order_id: poId,
    items: normalizedItems,
  });
}

export function buildDeleteCommandStatement(db, commandId) {
  return db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId);
}

export function resolveReservationOwnership(reservation = {}) {
  return reservation?.ownsReservation ?? Boolean(reservation?.insertStatement);
}

export function replayReservedCommand(
  reservation,
  requestFingerprint,
  { mismatchMessage, inFlightMessage } = {}
) {
  if (!reservation?.existing) return null;

  if (reservation.record?.request_fingerprint !== requestFingerprint) {
    throw new BadRequestError(mismatchMessage || '同一个幂等键不能提交不同请求');
  }

  const replay = parseStoredResponse(reservation.record?.response_json);
  if (reservation.record?.status === 'committed' && replay) {
    return replay;
  }

  throw new BadRequestError(inFlightMessage || '当前幂等键对应的命令仍在处理中');
}

export async function cleanupReservedCommand({
  commandIdempotencyRepo,
  db,
  ownsReservation,
  commandId,
}) {
  if (!ownsReservation || !commandId) return false;

  const deleteStatement =
    commandIdempotencyRepo.buildDeleteStatement?.(commandId) ||
    buildDeleteCommandStatement(db, commandId);
  await deleteStatement.run();
  return true;
}

export function buildFinalizeCommandStatements({
  db,
  commandIdempotencyRepo,
  purchaseOrderId,
  timestamp,
  commandId,
  response,
  status = 'committed',
  leadingStatements = [],
}) {
  const statements = [...leadingStatements];

  if (purchaseOrderId) {
    statements.push(
      db.prepare('UPDATE purchase_orders SET updated_at = ? WHERE id = ?').bind(timestamp, purchaseOrderId)
    );
  }

  statements.push(commandIdempotencyRepo.buildFinalizeStatement(commandId, response, status));
  return statements;
}

export async function requirePurchaseOrder(
  db,
  poId,
  {
    requiredMessage = 'purchase_order_id is required',
    notFoundMessage = '采购单不存在',
    allowedStatuses = null,
    invalidStatusMessage = '采购单状态不允许当前操作',
  } = {}
) {
  if (!poId) throw new BadRequestError(requiredMessage);

  const row = await db
    .prepare('SELECT id, status FROM purchase_orders WHERE id = ?')
    .bind(poId)
    .first();

  if (!row) throw new NotFoundError(notFoundMessage);

  if (Array.isArray(allowedStatuses) && allowedStatuses.length > 0) {
    const normalizedStatus = String(row.status || '').trim();
    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new BadRequestError(invalidStatusMessage);
    }
  }

  return row;
}

export async function requirePurchaseOrderItemForPo(
  db,
  poId,
  purchaseOrderItemId,
  {
    select = DEFAULT_PURCHASE_ORDER_ITEM_SELECT,
    requiredMessage = 'purchase_order_item_id is required',
    notFoundMessage = '采购单明细不存在',
    ownershipMessage = '采购单明细不属于当前采购单',
  } = {}
) {
  if (!purchaseOrderItemId) throw new BadRequestError(requiredMessage);

  const row = await db
    .prepare(
      `SELECT ${select}
       FROM purchase_order_items
       WHERE id = ?`
    )
    .bind(purchaseOrderItemId)
    .first();

  if (!row) throw new NotFoundError(notFoundMessage);
  if (poId && row.po_id !== poId) throw new BadRequestError(ownershipMessage);
  return row;
}

function buildPurchaseOrderItemQuantityStatement(
  db,
  poId,
  poItem,
  {
    quantityColumn,
    nextQuantity,
    nextDisplayStatus,
    expectedReceivedQty,
    expectedCancelledQty,
    expectedDisplayStatus = null,
    requiredRemainingQty = null,
  }
) {
  const whereClauses = [
    'id = ?',
    'AND po_id = ?',
    'AND received_qty = ?',
    'AND cancelled_qty = ?',
  ];
  const params = [
    toNonNegativeInt(nextQuantity),
    nextDisplayStatus,
    poItem.id,
    poId,
    toNonNegativeInt(expectedReceivedQty),
    toNonNegativeInt(expectedCancelledQty),
  ];

  if (requiredRemainingQty != null) {
    whereClauses.push(
      'AND COALESCE(quantity, 0) - COALESCE(received_qty, 0) - COALESCE(cancelled_qty, 0) >= ?'
    );
    params.push(toNonNegativeInt(requiredRemainingQty));
  }

  if (expectedDisplayStatus != null) {
    whereClauses.push('AND display_status = ?');
    params.push(expectedDisplayStatus);
  }

  return db
    .prepare(
      `UPDATE purchase_order_items
       SET ${quantityColumn} = ?, display_status = ?
       WHERE ${whereClauses.join('\n         ')}`
    )
    .bind(...params);
}

export function buildPurchaseOrderItemReceivedQtyStatement(
  db,
  poId,
  poItem,
  {
    nextReceivedQty,
    nextDisplayStatus,
    expectedReceivedQty = poItem?.received_qty,
    expectedCancelledQty = poItem?.cancelled_qty,
    expectedDisplayStatus = null,
    requiredRemainingQty = null,
  }
) {
  return buildPurchaseOrderItemQuantityStatement(db, poId, poItem, {
    quantityColumn: 'received_qty',
    nextQuantity: nextReceivedQty,
    nextDisplayStatus,
    expectedReceivedQty,
    expectedCancelledQty,
    expectedDisplayStatus,
    requiredRemainingQty,
  });
}

export function buildPurchaseOrderItemCancelledQtyStatement(
  db,
  poId,
  poItem,
  {
    nextCancelledQty,
    nextDisplayStatus,
    expectedReceivedQty = poItem?.received_qty,
    expectedCancelledQty = poItem?.cancelled_qty,
    expectedDisplayStatus = null,
    requiredRemainingQty = null,
  }
) {
  return buildPurchaseOrderItemQuantityStatement(db, poId, poItem, {
    quantityColumn: 'cancelled_qty',
    nextQuantity: nextCancelledQty,
    nextDisplayStatus,
    expectedReceivedQty,
    expectedCancelledQty,
    expectedDisplayStatus,
    requiredRemainingQty,
  });
}

export function buildCompatibilityOrderProcurementStatusStatement(
  db,
  orderId,
  procurementStatus,
  timestamp,
  { excludeTerminalStatuses = false, requireStatusChange = false } = {}
) {
  const whereClauses = ['id = ?'];
  const params = [procurementStatus, timestamp, orderId];

  if (excludeTerminalStatuses) {
    whereClauses.push("AND status NOT IN ('delivered', 'void')");
  }

  if (requireStatusChange) {
    whereClauses.push("AND COALESCE(procurement_status, 'none') != ?");
    params.push(procurementStatus);
  }

  return db
    .prepare(
      `UPDATE orders
       SET procurement_status = ?, updated_at = ?
       WHERE ${whereClauses.join('\n         ')}`
    )
    .bind(...params);
}

export async function requireOrderLine(db, orderId, orderLineId) {
  const row = await db
    .prepare(
      `SELECT id, order_id, product_id, variant_id, ordered_qty, procured_qty, received_qty, reserved_qty, shipped_qty, cancelled_qty
       FROM order_lines
       WHERE id = ? AND order_id = ?`
    )
    .bind(orderLineId, orderId)
    .first();

  if (!row) throw new NotFoundError('关联订单行不存在');
  return row;
}

export async function queryCompatibilityProcurementAggregate(db, orderId) {
  const progress = await db
    .prepare(
      `SELECT
          COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
          COALESCE(SUM(procured_qty), 0) AS procured_qty,
          COALESCE(SUM(received_qty), 0) AS received_qty,
          COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
       FROM order_lines
       WHERE order_id = ?`
    )
    .bind(orderId)
    .first();

  return {
    ordered_qty: toNonNegativeInt(progress?.ordered_qty),
    procured_qty: toNonNegativeInt(progress?.procured_qty),
    received_qty: toNonNegativeInt(progress?.received_qty),
    cancelled_qty: toNonNegativeInt(progress?.cancelled_qty),
  };
}
