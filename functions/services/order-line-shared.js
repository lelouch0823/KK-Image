import { BadRequestError } from '../lib/hono/errors.js';
import { toNonNegativeInt } from './purchase-order-projection.js';

/**
 * 解析订单行 ID（DemandService / InventoryService 共享）
 *
 * 优先使用 payload.orderLineId，否则按 orderId + variantId/productId 查询。
 * 多行订单时抛出 BadRequestError 要求显式指定 orderLineId。
 *
 * @param {D1Database} db
 * @param {object} payload
 * @returns {Promise<string|null>}
 */
export async function resolveOrderLineId(db, payload = {}) {
  if (payload.orderLineId) return payload.orderLineId;
  if (!payload.orderId || typeof db?.prepare !== 'function') return null;

  const candidates = await queryOrderLineCandidates(db, payload, true);
  if (candidates.length === 1) return candidates[0]?.id || null;
  if (candidates.length > 1) {
    throw new BadRequestError('orderLineId is required for multi-line orders');
  }

  if (payload.variantId || payload.productId) {
    const fallback = await queryOrderLineCandidates(db, payload, false);
    if (fallback.length === 1) return fallback[0]?.id || null;
    if (fallback.length > 1) {
      throw new BadRequestError('orderLineId is required for multi-line orders');
    }
  }

  return null;
}

/**
 * 查询候选订单行（DemandService / InventoryService / OrderProcurementDomainService 共享）
 *
 * @param {D1Database} db
 * @param {object} payload
 * @param {boolean} includeScopedFilters - 是否包含 variantId/productId 范围过滤
 * @param {object} [options]
 * @param {string} [options.selectColumns] - 自定义 SELECT 列，默认 'id'
 * @returns {Promise<Array>}
 */
export async function queryOrderLineCandidates(
  db,
  payload = {},
  includeScopedFilters = true,
  options = {}
) {
  if (!payload.orderId || typeof db?.prepare !== 'function') return [];

  const selectColumns = options.selectColumns || 'id';
  const filters = ['order_id = ?'];
  const params = [payload.orderId];

  if (includeScopedFilters && payload.variantId) {
    filters.push('variant_id = ?');
    params.push(payload.variantId);
  }
  if (includeScopedFilters && payload.productId) {
    filters.push('product_id = ?');
    params.push(payload.productId);
  }

  const statement = db
    .prepare(
      `SELECT ${selectColumns} FROM order_lines WHERE ${filters.join(' AND ')} ORDER BY created_at ASC LIMIT 2`
    )
    .bind(...params);

  if (typeof statement?.all === 'function') {
    const { results } = await statement.all();
    return results || [];
  }
  if (typeof statement?.first === 'function') {
    const row = await statement.first();
    return row ? [row] : [];
  }
  return [];
}

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
  { writeMode = 'full_projection', guardProjectionState = false, expectedDisplayStatus = null } = {}
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
