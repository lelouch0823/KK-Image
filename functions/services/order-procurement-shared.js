import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { toNonNegativeInt } from './purchase-order-projection.js';

export function parseStoredResponse(responseJson) {
  if (!responseJson) return null;
  try {
    return JSON.parse(responseJson);
  } catch {
    return null;
  }
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
