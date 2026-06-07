import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository.js';
import { BadRequestError } from '../lib/hono/errors.js';
import { chunkArray } from '../lib/db/batch.js';
import { validateOrderQuantity } from './purchase-order-constraints.js';

const D1_MAX_IN_CLAUSE_SIZE = 100;

function normalizeComparableQuantity(value, fallback = 1) {
  const normalized = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

export function validatePurchaseOrderUnitCost(unitCost, { label = 'unit_cost' } = {}) {
  if (unitCost === undefined || unitCost === null || unitCost === '') return;

  const normalized = Number(unitCost);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new BadRequestError(`${label} must be a non-negative number`);
  }
}

export async function validatePurchaseOrderVariantItems(db, items = []) {
  if (!items || items.length === 0) return;
  const variantIds = [...new Set(items.map((item) => item.variant_id).filter(Boolean))];
  if (variantIds.length !== items.length) {
    const hasMissing = items.some((item) => !item.variant_id);
    if (hasMissing) throw new BadRequestError('采购单明细必须包含 variant_id');
  }

  if (items.some((item) => !item.product_id || !item.variant_id)) {
    throw new BadRequestError('采购单明细必须包含 product_id 与 variant_id');
  }

  const variantMap = new Map();
  for (const variantIdChunk of chunkArray(variantIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = variantIdChunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `
      SELECT id, product_id, status,
             COALESCE(moq, 1) AS moq,
             COALESCE(pack_size, 1) AS pack_size,
             COALESCE(order_step, 1) AS order_step
      FROM product_variants
      WHERE id IN (${placeholders})
    `
      )
      .bind(...variantIdChunk)
      .all();
    for (const row of results || []) {
      variantMap.set(row.id, row);
    }
  }

  for (const item of items) {
    validatePurchaseOrderUnitCost(item.unit_cost);

    const variant = variantMap.get(item.variant_id);
    if (!variant) {
      throw new BadRequestError(`变体不存在: ${item.variant_id}`);
    }
    if (variant.product_id !== item.product_id) {
      throw new BadRequestError('variant_id 与 product_id 不匹配');
    }
    const variantIsActive = String(variant.status || '').toLowerCase() === 'active';
    const allowArchivedLinkedDemand = Boolean(item.pre_order_id);
    if (!variantIsActive && !allowArchivedLinkedDemand) {
      throw new BadRequestError('仅可采购 active 变体');
    }
    const result = validateOrderQuantity(item.quantity || 1, {
      moq: variant.moq,
      orderStep: variant.order_step,
      packSize: variant.pack_size,
    });
    if (!result.valid) {
      throw new BadRequestError(`${result.reason}（建议数量: ${result.suggestedQuantity}）`);
    }
  }
}

export async function validatePurchaseOrderPreOrderBinding(
  db,
  items = [],
  { repo, currentPoId = null } = {}
) {
  if (!items || items.length === 0) return;
  const linkedItems = items.filter((item) => item.pre_order_id);
  if (linkedItems.length === 0) return;

  const seenOrderLineKeys = new Set();
  for (const item of linkedItems) {
    const orderId = String(item.pre_order_id || '').trim();
    const orderLineId = String(item.order_line_id || '').trim();
    if (!orderId) continue;
    if (!orderLineId) continue;
    const dedupeKey = `${orderId}::${orderLineId}`;
    if (seenOrderLineKeys.has(dedupeKey)) {
      throw new BadRequestError('同一个 order_line_id 不能重复绑定到多条采购明细');
    }
    seenOrderLineKeys.add(dedupeKey);
  }

  const poRepo = repo || new PurchaseOrderRepository(db);
  const orderIds = [...new Set(linkedItems.map((item) => item.pre_order_id))];
  const orderMap = new Map();
  for (const orderIdChunk of chunkArray(orderIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = orderIdChunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `
      SELECT id, order_no, status, product_id, variant_id
      FROM orders
      WHERE id IN (${placeholders})
    `
      )
      .bind(...orderIdChunk)
      .all();
    for (const row of results || []) {
      orderMap.set(row.id, row);
    }
  }

  const orderLineMap = new Map();
  const orderLineCandidatesByOrderAndVariant = new Map();
  for (const orderIdChunk of chunkArray(orderIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = orderIdChunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `
      SELECT
        ol.id,
        ol.order_id,
        o.order_no,
        o.status,
        ol.product_id,
        ol.variant_id,
        ol.ordered_qty,
        ol.cancelled_qty,
        ol.shipped_qty
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      WHERE ol.order_id IN (${placeholders})
    `
      )
      .bind(...orderIdChunk)
      .all();

    for (const row of results || []) {
      orderLineMap.set(`${row.order_id}::${row.id}`, row);
      const candidateKey = `${row.order_id}::${row.product_id || ''}::${row.variant_id || ''}`;
      const existing = orderLineCandidatesByOrderAndVariant.get(candidateKey) || [];
      existing.push(row);
      orderLineCandidatesByOrderAndVariant.set(candidateKey, existing);
    }
  }

  const activeBindings = await poRepo.findActiveBindingsByPreOrderIds(orderIds);
  const bindingMap = new Map(activeBindings.map((binding) => [binding.pre_order_id, binding]));

  for (const item of linkedItems) {
    const order = orderMap.get(item.pre_order_id);
    if (!order) {
      throw new BadRequestError(`预订单不存在: ${item.pre_order_id}`);
    }
    if (order.status !== 'confirmed') {
      throw new BadRequestError('仅可关联 confirmed 状态的预订单');
    }
    const explicitOrderLineId = String(item.order_line_id || '').trim();
    const explicitLine = explicitOrderLineId
      ? orderLineMap.get(`${item.pre_order_id}::${explicitOrderLineId}`) || null
      : null;
    const matchedCandidates =
      orderLineCandidatesByOrderAndVariant.get(
        `${item.pre_order_id}::${item.product_id || ''}::${item.variant_id || ''}`
      ) || [];
    const matchedOrderLine =
      explicitLine || (matchedCandidates.length === 1 ? matchedCandidates[0] : null);

    if (explicitOrderLineId && !matchedOrderLine) {
      throw new BadRequestError('pre_order_id 与 order_line_id 不匹配');
    }
    if (!explicitOrderLineId && matchedCandidates.length > 1) {
      throw new BadRequestError('同一订单内存在多条相同商品/变体的订单行，请提供 order_line_id');
    }

    if (matchedOrderLine) {
      if (
        matchedOrderLine.product_id !== item.product_id ||
        matchedOrderLine.variant_id !== item.variant_id
      ) {
        throw new BadRequestError('pre_order_id 与商品/变体不匹配');
      }
    } else if (order.product_id !== item.product_id || order.variant_id !== item.variant_id) {
      throw new BadRequestError('pre_order_id 与商品/变体不匹配');
    }

    const expectedQuantity = matchedOrderLine
      ? normalizeComparableQuantity(
          Math.max(
            Number(matchedOrderLine.ordered_qty || 0) -
              Number(matchedOrderLine.cancelled_qty || 0) -
              Number(matchedOrderLine.shipped_qty || 0),
            0
          ),
          1
        )
      : normalizeComparableQuantity(order.quantity, 1);
    const requestedQuantity = normalizeComparableQuantity(item.quantity, 1);
    if (requestedQuantity !== expectedQuantity) {
      throw new BadRequestError('pre_order_id 与订单数量不匹配');
    }
    const binding = bindingMap.get(item.pre_order_id);
    if (binding && binding.po_id !== currentPoId) {
      throw new BadRequestError(
        `${order.order_no || item.pre_order_id} 已在采购单 ${binding.po_no || binding.po_id} 中`
      );
    }
  }
}
