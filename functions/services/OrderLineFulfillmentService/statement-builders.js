import { toNonNegativeInt } from '../../api/utils/number.js';
import { getDomainEventDefinition } from '../DomainEventCatalog.js';
import { projectOrderLineStatus } from '../OrderStatusProjectionService.js';
import {
  buildBalanceDeltaUpsertStatement,
  buildGuardedHoldUpsertStatement,
} from '../_shared/inventory-write-statements.js';

export function buildNextLineState(line, overrides = {}) {
  const next = {
    ordered_qty: toNonNegativeInt(line.ordered_qty),
    procured_qty: toNonNegativeInt(line.procured_qty),
    received_qty: toNonNegativeInt(line.received_qty),
    reserved_qty: toNonNegativeInt(line.reserved_qty),
    shipped_qty: toNonNegativeInt(line.shipped_qty),
    cancelled_qty: toNonNegativeInt(line.cancelled_qty),
    ...overrides,
  };

  next.display_status = projectOrderLineStatus(next);
  return next;
}

export function buildOrderTouchStatement(db, orderId, timestamp) {
  return db
    .prepare('UPDATE orders SET updated_at = ? WHERE id = ?')
    .bind(timestamp, orderId);
}

export function buildShipmentLedgerStatement(db, uuidFn, {
  orderId,
  lineId,
  variantId,
  actionType,
  quantity,
  actorName,
  note = '',
  timestamp,
}) {
  return db
    .prepare(
      `INSERT INTO order_shipments (
         id, order_id, order_line_id, variant_id, action_type, quantity, note, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      uuidFn(),
      orderId,
      lineId,
      variantId || null,
      actionType,
      quantity,
      note,
      actorName || null,
      timestamp
    );
}

export function buildReservationMovementStatements(db, uuidFn, {
  variantId,
  orderId,
  lineId,
  quantityDelta,
  eventType,
  timestamp,
  metadata = {},
}) {
  const ledgerId = uuidFn();
  const inventoryEventId = uuidFn();

  return {
    inventoryEventId,
    statements: [
      // 行级预留是硬预留：持有可能力守卫（on_hand - reserved >= 增量），
      // 两个并发 reserve 同时通过 batch 外容量检查时由 WHERE 谓词 + changes()
      // 断言仲裁（审查 C-H2）；释放（负增量）由 CHECK(reserved >= 0) 兜底
      ...(quantityDelta > 0
        ? buildGuardedHoldUpsertStatement(db, {
            variantId,
            reservedDelta: quantityDelta,
            timestamp,
          })
        : [
            buildBalanceDeltaUpsertStatement(db, {
              variantId,
              onHandDelta: 0,
              reservedDelta: quantityDelta,
              timestamp,
            }),
          ]),
      db
        .prepare(
          `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          ledgerId,
          variantId,
          eventType,
          quantityDelta,
          'order_line',
          lineId,
          timestamp,
          JSON.stringify({
            orderId,
            lineId,
            ...metadata,
          }),
          timestamp
        ),
      db
        .prepare(
          `INSERT INTO inventory_events (
            id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
            source_type, source_id, metadata, occurred_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          inventoryEventId,
          variantId,
          lineId,
          null,
          eventType,
          quantityDelta,
          'order_line',
          lineId,
          JSON.stringify({
            orderId,
            lineId,
            ...metadata,
          }),
          timestamp,
          timestamp
        ),
    ],
  };
}

export function buildOutboxStatements(domainOutboxRepo, uuidFn, {
  order,
  orderId,
  lineId,
  action,
  quantity,
  nextLineState,
  returnedQtyAfter = null,
  timestamp,
  actorName = null,
}) {
  const commandId = uuidFn();
  const outboxEvents = [];

  outboxEvents.push({
    id: uuidFn(),
    command_id: commandId,
    sequence_in_command: 1,
    event_type: 'order_line_fulfillment_updated',
    event_version: 1,
    aggregate_type: 'order',
    aggregate_id: orderId,
    correlation_id: commandId,
    causation_id: commandId,
    idempotency_key: `${commandId}:${lineId}:${action}`,
    payload_json: JSON.stringify({
      order_id: orderId,
      order_no: order.order_no || null,
      salesperson_id: order.salesperson_id || null,
      order_line_id: lineId,
      variant_id: order.variant_id || null,
      action,
      quantity,
      actor_name: actorName,
      reserved_qty_after: nextLineState.reserved_qty,
      shipped_qty_after: nextLineState.shipped_qty,
      returned_qty_after: returnedQtyAfter,
      display_status_after: nextLineState.display_status,
    }),
    occurred_at: timestamp,
  });

  return domainOutboxRepo.buildInsertStatements(
    outboxEvents,
    (event) => getDomainEventDefinition(event.event_type).consumers
  );
}

export function buildCommandResult({
  orderId,
  lineId,
  action,
  quantity,
  nextLineState,
  returnedQtyAfter = null,
  inventory,
}) {
  return {
    order_id: orderId,
    order_line_id: lineId,
    action,
    quantity,
    order_line: {
      reserved_qty: nextLineState.reserved_qty,
      shipped_qty: nextLineState.shipped_qty,
      returned_qty: returnedQtyAfter,
      display_status: nextLineState.display_status,
    },
    inventory,
  };
}
