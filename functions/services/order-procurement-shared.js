import { NotFoundError } from '../lib/hono/errors.js';
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
