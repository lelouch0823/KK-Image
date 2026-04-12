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
    const { results } = await db.prepare(`
      SELECT id, product_id, status,
             COALESCE(moq, 1) AS moq,
             COALESCE(pack_size, 1) AS pack_size,
             COALESCE(order_step, 1) AS order_step
      FROM product_variants
      WHERE id IN (${placeholders})
    `).bind(...variantIdChunk).all();
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

export async function validatePurchaseOrderPreOrderBinding(db, items = [], { repo, currentPoId = null } = {}) {
  if (!items || items.length === 0) return;
  const linkedItems = items.filter((item) => item.pre_order_id);
  if (linkedItems.length === 0) return;

  const seenOrderIds = new Set();
  for (const item of linkedItems) {
    const orderId = String(item.pre_order_id || '').trim();
    if (!orderId) continue;
    if (seenOrderIds.has(orderId)) {
      throw new BadRequestError('同一个 pre_order_id 不能重复绑定到多条采购明细');
    }
    seenOrderIds.add(orderId);
  }

  const poRepo = repo || new PurchaseOrderRepository(db);
  const orderIds = [...new Set(linkedItems.map((item) => item.pre_order_id))];
  const orderMap = new Map();
  for (const orderIdChunk of chunkArray(orderIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = orderIdChunk.map(() => '?').join(',');
    const { results } = await db.prepare(`
      SELECT id, order_no, status, product_id, variant_id
      FROM orders
      WHERE id IN (${placeholders})
    `).bind(...orderIdChunk).all();
    for (const row of results || []) {
      orderMap.set(row.id, row);
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
    if (order.product_id !== item.product_id || order.variant_id !== item.variant_id) {
      throw new BadRequestError('pre_order_id 与商品/变体不匹配');
    }
    const expectedQuantity = normalizeComparableQuantity(order.quantity, 1);
    const requestedQuantity = normalizeComparableQuantity(item.quantity, 1);
    if (requestedQuantity !== expectedQuantity) {
      throw new BadRequestError('pre_order_id 与订单数量不匹配');
    }
    const binding = bindingMap.get(item.pre_order_id);
    if (binding && binding.po_id !== currentPoId) {
      throw new BadRequestError(`${order.order_no || item.pre_order_id} 已在采购单 ${binding.po_no || binding.po_id} 中`);
    }
  }
}
