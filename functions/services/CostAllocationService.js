/**
 * 成本分摊服务 (Cost Allocation Service)
 * =========================================
 *
 * 封装采购单运费/关税分摊逻辑：
 * - by_quantity: 按件数平均分摊
 * - by_value: 按已收货金额比例分摊
 *
 * @module services/CostAllocationService
 */

import { BadRequestError } from '../lib/hono/errors.js';
import { toNumber } from '../api/utils/number.js';

function getReceivedAllocationQty(item = {}) {
  return Math.max(toNumber(item.received_qty), 0);
}

/**
 * 以"分"为整数单位的最大余额法：把 totalCents 按权重比例分配到各明细，
 * 保证 Σ(分得的分数) === totalCents 精确成立（审查 B2 修复的核心不变量）。
 * @param {Array<Object>} items 参与分配的明细
 * @param {number} totalCents 待分配总额（分）
 * @param {(item: Object) => number} weightOf 权重函数
 * @returns {number[]} 每明细分得的"分"数（与 items 索引对齐）
 */
function distributeCentsByWeight(items, totalCents, weightOf) {
  const weights = items.map((item) => Math.max(Number(weightOf(item)) || 0, 0));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (!(weightSum > 0) || totalCents === 0) return weights.map(() => 0);

  const raw = weights.map((w) => (w / weightSum) * totalCents);
  const base = raw.map((v) => Math.floor(v));
  let remainder = totalCents - base.reduce((sum, c) => sum + c, 0);
  const order = raw
    .map((value, idx) => ({ idx, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    base[order[i].idx] += 1;
  }
  // 兜底：浮点极端情况下余量可能超出明细数，循环均摊剩余部分
  let cursor = 0;
  while (remainder > 0) {
    base[order[cursor % order.length].idx] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return base;
}

/**
 * 把明细分得的"分"换算为单件金额（元）。
 *
 * purchase_order_items.allocated_freight / allocated_tariff 的列语义是
 * "分摊后的单件运费/关税"（migration 0035），MAC 重算按
 * (unit_cost + allocated_freight + allocated_tariff) × received_qty 计入，
 * 因此分摊结果必须写到单件粒度：Σ(perUnit_i × qty_i) === 总额。
 * @param {number} cents 明细分得的分数
 * @param {number} qty 明细已收货件数（>0，由调用方保证）
 * @returns {number} 单件金额（元）
 */
function centsToPerUnitYuan(cents, qty) {
  return cents / Math.max(qty, 1) / 100;
}

/**
 * 按已收货金额（unit_cost × received_qty）比例把总额分配到各明细，
 * 返回单件金额：Σ(单件分摊 × 已收货数量) 与总额精确相等（分粒度）。
 * @param {Array<Object>} items 采购单明细
 * @param {number} total 待分配总额（元）
 * @returns {Map<string, number>} itemId -> 单件分摊金额（元）
 */
function distributePerUnitByValue(items, total) {
  const result = new Map();
  // 元 → 分必须显式 ×100：total 以元传入，漏乘会把分摊额缩小 100 倍（审查 B2）
  const totalCents = Math.round((Number(total) || 0) * 100);
  const eligible = items.filter((item) => getReceivedAllocationQty(item) > 0);
  for (const item of items) result.set(item.id, 0);
  if (eligible.length === 0 || totalCents === 0) return result;

  const cents = distributeCentsByWeight(
    eligible,
    totalCents,
    (item) => (Number(item.unit_cost) || 0) * getReceivedAllocationQty(item)
  );
  eligible.forEach((item, idx) => {
    result.set(item.id, centsToPerUnitYuan(cents[idx], getReceivedAllocationQty(item)));
  });
  return result;
}

function requireCompletedPurchaseOrderForAllocation(po) {
  if (po?.status !== 'completed') {
    throw new BadRequestError('仅已结算采购单允许执行成本分摊');
  }
}

export class CostAllocationService {
  /**
   * @param {D1Database} db
   * @param {Object} deps - 依赖注入
   * @param {import('../repositories/PurchaseOrderRepository.js').PurchaseOrderRepository} deps.repo
   * @param {import('../repositories/ProductVariantRepository.js').ProductVariantRepository} deps.variantRepo
   */
  constructor(db, deps = {}) {
    this.db = db;
    this.repo = deps.repo;
    this.variantRepo = deps.variantRepo;
  }

  /**
   * 分摊运费和关税到各明细项
   * 支持两种分摊方式：
   * - by_quantity: 按件数平均分摊
   * - by_value: 按商品入货金额比例分摊
   *
   * @param {string} poId
   */
  async allocateCosts(poId) {
    const po = await this.repo.findById(poId);
    if (!po) return;
    requireCompletedPurchaseOrderForAllocation(po);

    // 优先使用实际费用，未填则使用预估费用
    const shippingCost = po.actual_shipping_cost ?? po.estimated_shipping_cost ?? 0;
    const tariffCost = po.actual_tariff_cost ?? po.estimated_tariff_cost ?? 0;

    if (shippingCost === 0 && tariffCost === 0) return;

    const items = await this.repo.getItemsForAllocation(poId);
    if (items.length === 0) return;

    let allocations;

    if (po.allocation_method === 'by_value') {
      // --- 按已收货金额比例分摊 ---
      const totalValue = items.reduce(
        (sum, item) => sum + (Number(item.unit_cost) || 0) * getReceivedAllocationQty(item),
        0
      );

      if (totalValue === 0) {
        // 回退到按件数分摊
        allocations = this._allocateByQuantity(items, shippingCost, tariffCost);
      } else {
        // 以"分"为单位做最大余额法分配，保证
        // Σ(单件 allocated_freight × received_qty) == shippingCost、
        // Σ(单件 allocated_tariff × received_qty) == tariffCost 精确成立
        // （列语义是单件运费/关税，写入前换算到单件粒度——审查 B2）
        const freightByItem = distributePerUnitByValue(items, shippingCost);
        const tariffByItem = distributePerUnitByValue(items, tariffCost);
        allocations = items.map((item) => ({
          id: item.id,
          allocated_freight: freightByItem.get(item.id) || 0,
          allocated_tariff: tariffByItem.get(item.id) || 0,
        }));
      }
    } else {
      // --- 按件数平均分摊 (默认) ---
      allocations = this._allocateByQuantity(items, shippingCost, tariffCost);
    }

    // 记录本次分摊前各明细已有的分摊额（来自上一次分摊运行），
    // 用于下方 MAC 重算时反解出"未含运费/关税"的存量成本
    const previousAllocations = items.map((item) => ({
      id: item.id,
      variant_id: item.variant_id,
      allocated_freight: Number(item.allocated_freight) || 0,
      allocated_tariff: Number(item.allocated_tariff) || 0,
      receivedQty: getReceivedAllocationQty(item),
    }));

    const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
    const macInputsByVariant = new Map();
    for (const item of items) {
      if (!item.variant_id) continue;
      const itemQty = getReceivedAllocationQty(item);
      if (itemQty <= 0) continue;

      const allocation = allocationById.get(item.id) || {};
      const unitCost = Number(item.unit_cost) || 0;
      const perUnitFreight = Number(allocation.allocated_freight) || 0;
      const perUnitTariff = Number(allocation.allocated_tariff) || 0;
      const itemTotalLandedCost = (unitCost + perUnitFreight + perUnitTariff) * itemQty;

      const existing = macInputsByVariant.get(item.variant_id) || {
        quantity: 0,
        totalCost: 0,
      };
      existing.quantity += itemQty;
      existing.totalCost += itemTotalLandedCost;
      macInputsByVariant.set(item.variant_id, existing);
    }

    // 构建所有语句，合并到单个 D1 batch 原子执行
    const allStatements = [];

    // 1. 分摊费用更新语句
    for (const allocation of allocations) {
      allStatements.push(
        this.db
          .prepare(
            `
          UPDATE purchase_order_items SET allocated_freight = ?, allocated_tariff = ? WHERE id = ?
        `
          )
          .bind(allocation.allocated_freight, allocation.allocated_tariff, allocation.id)
      );
    }

    // 2. MAC 成本更新语句
    const macTimestamp = Date.now();
    // 汇总每个变体此前已计入 cost_price 的分摊总额（上一次分摊运行的影响）
    const previousCostByVariant = new Map();
    for (const prev of previousAllocations) {
      if (!prev.variant_id || prev.receivedQty <= 0) continue;
      const prevCost = (prev.allocated_freight + prev.allocated_tariff) * prev.receivedQty;
      if (prevCost <= 0) continue;
      previousCostByVariant.set(
        prev.variant_id,
        (previousCostByVariant.get(prev.variant_id) || 0) + prevCost
      );
    }
    for (const [variantId, input] of macInputsByVariant.entries()) {
      const safeArrivedQty = Math.max(0, Number(input.quantity) || 0);
      const totalCost = Number(input.totalCost || 0);
      const previousTotalCost = previousCostByVariant.get(variantId) || 0;
      const denominator = safeArrivedQty; // 加上 max(stock - arrived, 0) 即 SQL 内 MAX(stock, arrived)
      if (denominator <= 0 && totalCost <= 0) continue;

      // C-M4：MAC 重算改为单语句原子更新——stock_quantity/cost_price 在语句
      // 执行时读取（并发出入库后的最新值），不再 batch 外读快照后覆盖写。
      // 重复分摊仍按上次影响额反解基线（与原语义一致，反解同样在语句内完成）
      allStatements.push(
        this.db
          .prepare(
            `UPDATE product_variants
             SET cost_price = (
                   (
                     CASE
                       WHEN MAX(stock_quantity - ?, 0) > 0 AND ? > 0
                         THEN MAX(0, (cost_price * MAX(stock_quantity, ?) - ?) / MAX(stock_quantity - ?, 0))
                       ELSE MAX(cost_price, 0)
                     END
                   ) * MAX(stock_quantity - ?, 0) + ?
                 ) / MAX(stock_quantity, ?),
               updated_at = ?
             WHERE id = ?`
          )
          .bind(
            safeArrivedQty, previousTotalCost,
            safeArrivedQty, previousTotalCost, safeArrivedQty,
            safeArrivedQty, totalCost,
            safeArrivedQty,
            macTimestamp, variantId
          )
      );
    }

    // 3. 原子执行所有语句
    // batch 原子性保证要么全部成功要么全部失败，无需手动回滚
    if (allStatements.length > 0) {
      await this.db.batch(allStatements);
    }
  }

  /**
   * 按件数分摊（最大余额法，单件粒度）
   *
   * 权重是每明细的已收货件数（不是明细条数）：1 条 qty=10 与 1 条 qty=1
   * 的运费必须按 10:1 而非 1:1 分配，否则 Σ(单件 × 数量) 会放大/缩小总额
   * （审查 B2）。Σ(单件 allocated_freight × received_qty) 与运费总额精确相等。
   */
  _allocateByQuantity(items, shippingCost, tariffCost) {
    const zero = () => items.map((item) => ({ id: item.id, allocated_freight: 0, allocated_tariff: 0 }));
    const eligible = items.filter((item) => getReceivedAllocationQty(item) > 0);
    if (eligible.length === 0) return zero();

    const distribute = (total) => {
      const totalCents = Math.round((Number(total) || 0) * 100);
      const cents = distributeCentsByWeight(eligible, totalCents, (item) =>
        getReceivedAllocationQty(item)
      );
      return new Map(
        eligible.map((item, idx) => [
          item.id,
          centsToPerUnitYuan(cents[idx], getReceivedAllocationQty(item)),
        ])
      );
    };

    const freightAllocations = distribute(shippingCost);
    const tariffAllocations = distribute(tariffCost);

    return items.map((item) => ({
      id: item.id,
      allocated_freight: freightAllocations.get(item.id) || 0,
      allocated_tariff: tariffAllocations.get(item.id) || 0,
    }));
  }
}
