import { BadRequestError } from '../lib/hono/errors.js';
import { toNonNegativeInt } from './purchase-order-projection.js';

export function parsePositiveLineCommandQuantity(payload = {}) {
  const quantity = Number(payload.quantity ?? payload.qty ?? payload.amount);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestError('quantity must be a positive number');
  }
  return Math.floor(quantity);
}

export async function queryInventoryBalance(db, variantId) {
  if (!variantId) return null;

  const balance = await db
    .prepare(
      `SELECT variant_id, on_hand, reserved, available
       FROM inventory_balances
       WHERE variant_id = ?`
    )
    .bind(variantId)
    .first();

  return {
    variant_id: variantId,
    on_hand: toNonNegativeInt(balance?.on_hand),
    reserved: toNonNegativeInt(balance?.reserved),
    available: toNonNegativeInt(balance?.available),
  };
}

export function buildOrderLineProjectionStatement(
  db,
  nextOrderLine,
  expectedOrderLine,
  timestamp,
  {
    writeMode = 'full_projection',
    guardProjectionState = false,
    expectedDisplayStatus = null,
  } = {}
) {
  const whereClauses = ['id = ? AND order_id = ?'];
  const setClauses =
    writeMode === 'received_only'
      ? ['received_qty = ?', 'display_status = ?', 'updated_at = ?']
      : [
          'ordered_qty = ?',
          'procured_qty = ?',
          'received_qty = ?',
          'reserved_qty = ?',
          'shipped_qty = ?',
          'cancelled_qty = ?',
          'display_status = ?',
          'updated_at = ?',
        ];
  const params =
    writeMode === 'received_only'
      ? [
          toNonNegativeInt(nextOrderLine.received_qty),
          nextOrderLine.display_status,
          timestamp,
          nextOrderLine.id,
          nextOrderLine.order_id,
        ]
      : [
          toNonNegativeInt(nextOrderLine.ordered_qty),
          toNonNegativeInt(nextOrderLine.procured_qty),
          toNonNegativeInt(nextOrderLine.received_qty),
          toNonNegativeInt(nextOrderLine.reserved_qty),
          toNonNegativeInt(nextOrderLine.shipped_qty),
          toNonNegativeInt(nextOrderLine.cancelled_qty),
          nextOrderLine.display_status,
          timestamp,
          nextOrderLine.id,
          nextOrderLine.order_id,
        ];

  if (guardProjectionState) {
    whereClauses.push(
      'AND received_qty = ?',
      'AND cancelled_qty = ?',
      'AND ordered_qty = ?',
      'AND procured_qty = ?',
      'AND reserved_qty = ?',
      'AND shipped_qty = ?'
    );
    params.push(
      toNonNegativeInt(expectedOrderLine.received_qty),
      toNonNegativeInt(expectedOrderLine.cancelled_qty),
      toNonNegativeInt(expectedOrderLine.ordered_qty),
      toNonNegativeInt(expectedOrderLine.procured_qty),
      toNonNegativeInt(expectedOrderLine.reserved_qty),
      toNonNegativeInt(expectedOrderLine.shipped_qty)
    );
  }

  if (expectedDisplayStatus != null) {
    whereClauses.push('AND display_status = ?');
    params.push(expectedDisplayStatus);
  }

  return db
    .prepare(
      `UPDATE order_lines
       SET ${setClauses.join(',\n           ')}
       WHERE ${whereClauses.join('\n         ')}`
    )
    .bind(...params);
}
