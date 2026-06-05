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
      const totalValue = items.reduce((sum, item) => (
        sum + ((Number(item.unit_cost) || 0) * getReceivedAllocationQty(item))
      ), 0);

      if (totalValue === 0) {
        // 回退到按件数分摊
        allocations = this._allocateByQuantity(items, shippingCost, tariffCost);
      } else {
        allocations = items.map(item => {
          const receivedQty = getReceivedAllocationQty(item);
          if (receivedQty <= 0) {
            return {
              id: item.id,
              allocated_freight: 0,
              allocated_tariff: 0,
            };
          }

          const valueRatio = ((Number(item.unit_cost) || 0) * receivedQty) / totalValue;
          return {
            id: item.id,
            allocated_freight: Math.round(shippingCost * valueRatio / receivedQty * 100) / 100,
            allocated_tariff: Math.round(tariffCost * valueRatio / receivedQty * 100) / 100,
          };
        });
      }
    } else {
      // --- 按件数平均分摊 (默认) ---
      allocations = this._allocateByQuantity(items, shippingCost, tariffCost);
    }

    const previousAllocations = items.map((item) => ({
      id: item.id,
      allocated_freight: Number(item.allocated_freight) || 0,
      allocated_tariff: Number(item.allocated_tariff) || 0,
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

    const macRollbackSnapshots = [];
    try {
      await this.repo.updateAllocations(allocations);

      // 批量读取当前成本价格，构建 MAC 更新语句
      const macStatements = [];
      const macTimestamp = Date.now();
      for (const [variantId, input] of macInputsByVariant.entries()) {
        const variantBefore =
          typeof this.variantRepo.findById === 'function'
            ? await this.variantRepo.findById(variantId)
            : await this.db
              .prepare('SELECT stock_quantity, cost_price FROM product_variants WHERE id = ?')
              .bind(variantId)
              .first();
        macRollbackSnapshots.push({
          variantId,
          costPrice: variantBefore?.cost_price ?? null,
        });

        const currentStockQty = Math.max(0, Number(variantBefore?.stock_quantity) || 0);
        const currentCost = Number(variantBefore?.cost_price) || 0;
        const safeArrivedQty = Math.max(0, Number(input.quantity) || 0);
        const preArrivalQty = Math.max(currentStockQty - safeArrivedQty, 0);
        const denominator = preArrivalQty + safeArrivedQty;
        if (denominator <= 0) continue;

        const nextCost = ((preArrivalQty * currentCost) + Number(input.totalCost || 0)) / denominator;
        macStatements.push(
          this.db
            .prepare('UPDATE product_variants SET cost_price = ?, updated_at = ? WHERE id = ?')
            .bind(nextCost, macTimestamp, variantId)
        );
      }

      if (macStatements.length > 0) {
        await this.db.batch(macStatements);
      }
    } catch (error) {
      if (macRollbackSnapshots.length > 0) {
        const rollbackTimestamp = Date.now();
        const rollbackStatements = macRollbackSnapshots.map((snapshot) =>
          this.db
            .prepare('UPDATE product_variants SET cost_price = ?, updated_at = ? WHERE id = ?')
            .bind(snapshot.costPrice, rollbackTimestamp, snapshot.variantId)
        );
        await this.db.batch(rollbackStatements);
      }
      await this.repo.updateAllocations(previousAllocations);
      throw error;
    }
  }

  /**
   * 按件数平均分摊
   */
  _allocateByQuantity(items, shippingCost, tariffCost) {
    const totalQty = items.reduce((sum, item) => sum + getReceivedAllocationQty(item), 0);
    if (totalQty === 0) {
      return items.map((item) => ({
        id: item.id,
        allocated_freight: 0,
        allocated_tariff: 0,
      }));
    }

    const freightPerUnit = Math.round(shippingCost / totalQty * 100) / 100;
    const tariffPerUnit = Math.round(tariffCost / totalQty * 100) / 100;

    return items.map(item => ({
      id: item.id,
      allocated_freight: getReceivedAllocationQty(item) > 0 ? freightPerUnit : 0,
      allocated_tariff: getReceivedAllocationQty(item) > 0 ? tariffPerUnit : 0,
    }));
  }
}
