/**
 * 采购单业务服务 (Purchase Order Service)
 * =========================================
 *
 * 核心业务逻辑层，封装：
 * 1. 状态机级联 (Cascading State Machine) — 采购单状态变更时自动流转预订单
 * 2. 动态成本分摊 (Cost Allocation) — 运费/关税按件数或金额比例分摊到明细
 * 3. 智能建议采购 — 基于订货总览缺口推荐待采购商品
 *
 * @module services/PurchaseOrderService
 */

import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { NotFoundError, BadRequestError } from '../lib/hono/errors.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';
import { InventoryService } from './InventoryService.js';
import { DemandService } from './DemandService.js';
import {
  validatePurchaseOrderPreOrderBinding,
  validatePurchaseOrderVariantItems,
} from './purchase-order-item-validation.js';
import {
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from './purchase-order-projection.js';

const D1_MAX_IN_CLAUSE_SIZE = 100;

function resolveInventorySnapshot(row = {}) {
  const onHand = Number(row.on_hand ?? row.stock_quantity ?? 0) || 0;
  const reserved = Number(row.reserved ?? 0) || 0;
  const available = Number(row.available ?? Math.max(onHand - reserved, 0)) || 0;

  return { onHand, reserved, available };
}

function buildSuggestionPricing(row, lastPurchasePriceMap) {
  const variantCostPrice = Number(row.cost_price) || 0;
  const rawSuggested = Number(row.suggested_purchase_price) || 0;
  const suggestedPurchasePrice = rawSuggested > 0 ? rawSuggested : variantCostPrice;
  const hasLastPrice = Object.prototype.hasOwnProperty.call(lastPurchasePriceMap, row.variant_id);
  const lastPurchasePrice = hasLastPrice ? lastPurchasePriceMap[row.variant_id] : null;
  const priceDelta = lastPurchasePrice == null
    ? null
    : Math.round((suggestedPurchasePrice - lastPurchasePrice) * 100) / 100;

  return {
    variant_cost_price: variantCostPrice,
    suggested_purchase_price: suggestedPurchasePrice,
    last_purchase_price: lastPurchasePrice,
    price_delta: priceDelta,
  };
}

function toNumber(value) {
  return Number(value || 0);
}

function getReceivedAllocationQty(item = {}) {
  return Math.max(toNumber(item.received_qty), 0);
}

function requireCompletedPurchaseOrderForAllocation(po) {
  if (po?.status !== 'completed') {
    throw new BadRequestError('仅已结算采购单允许执行成本分摊');
  }
}

export class PurchaseOrderService {
  /**
   * @param {D1Database} db
   */
  constructor(db) {
    this.db = db;
    this.repo = new PurchaseOrderRepository(db);
    this.variantRepo = new ProductVariantRepository(db);
    this.inventoryService = new InventoryService(db, this.variantRepo);
    this.demandService = new DemandService(db);
  }

  // ─── 状态机级联 (Cascading State Machine) ────────────

  /**
   * 变更采购单状态，并级联更新关联预订单
   * @param {string} poId - 采购单 ID
   * @param {string} newStatus - 目标状态
   * @returns {Promise<{success: boolean, cascadedOrders: number, stockUpdated: number, totalStockAdded: number}>}
   */
  async updateStatus(poId, newStatus) {
    // 1. 校验当前状态是否允许跳转
    const po = await this.repo.findById(poId);
    if (!po) throw new NotFoundError('采购单不存在');

    const validTransitions = {
      draft: ['ordered', 'cancelled'],
      ordered: ['shipping', 'cancelled'],
      shipping: ['arrived'],
      arrived: ['completed'],
      // completed 和 cancelled 不允许再跳转
    };

    const allowed = validTransitions[po.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestError(`无法从 "${po.status}" 转换到 "${newStatus}"。允许的目标状态: ${allowed.join(', ')}`);
    }

    if (po.status === 'shipping' && newStatus === 'arrived') {
      const outstandingQty = getPurchaseOrderOutstandingQty(po);
      if (outstandingQty > 0) {
        throw new BadRequestError(`采购单仍有待收数量 ${outstandingQty}，不能标记为已入库`);
      }
    }

    if (newStatus === 'cancelled') {
      const receivedQty = getPurchaseOrderReceivedQty(po);
      if (receivedQty > 0) {
        throw new BadRequestError(`采购单已有收货数量 ${receivedQty}，不能直接取消`);
      }
    }

    // 2. CAS 更新采购单状态（防并发重复流转）
    const updated = typeof this.repo.updateStatusIfCurrent === 'function'
      ? await this.repo.updateStatusIfCurrent(poId, po.status, newStatus)
      : await this.repo.updateStatus(poId, newStatus);
    if (!updated) {
      throw new BadRequestError('采购单状态已变化，请刷新后重试');
    }

    // 3. 级联更新预订单采购状态（不再修改订单主状态）
    let cascadedOrders = 0;
    let changedOrderIds = [];
    let changedOrderStatuses = [];
    const targetProcurementStatus = ['ordered', 'shipping'].includes(newStatus) ? 'ordered' : null;

    if (targetProcurementStatus) {
      const linkedOrderIds = await this.repo.getLinkedOrderIds(poId);
      if (linkedOrderIds.length > 0) {
        const now = Date.now();
        const stmts = linkedOrderIds.map(orderId =>
          this.db.prepare(
            `UPDATE orders
             SET procurement_status = ?, updated_at = ?
             WHERE id = ?
               AND status NOT IN ('delivered', 'void')
               AND COALESCE(procurement_status, 'none') = 'none'`
          ).bind(targetProcurementStatus, now, orderId)
        );
        const results = await executeBatchChunks(this.db, stmts);
        cascadedOrders = results.filter(r => r.meta?.changes > 0).length;
        changedOrderIds = linkedOrderIds.filter((_orderId, index) => (results[index]?.meta?.changes || 0) > 0);
        changedOrderStatuses = changedOrderIds.map((orderId) => ({
          orderId,
          procurementStatus: targetProcurementStatus,
        }));
      }
    }

    // 4. 如果是结算完成，触发成本分摊
    if (newStatus === 'completed') {
      try {
        await this.allocateCosts(poId);
      } catch (error) {
        await this.repo.updateStatusIfCurrent(poId, newStatus, po.status);
        throw error;
      }
    }

    const stockUpdated = 0;
    const totalStockAdded = 0;
    return {
      success: true,
      cascadedOrders,
      changedOrderIds,
      changedOrderStatuses,
      targetProcurementStatus: targetProcurementStatus || null,
      stockUpdated,
      totalStockAdded,
    };
  }

  // ─── 动态成本分摊 (Cost Allocation) ─────────────────

  /**
   * 分摊运费和关税到各明细项
   * 支持两种分摊方式：
   * - by_quantity: 按件数平均分摊
   * - by_value: 按商品入货金额比例分摊
   *
   * @param {string} poId
   */
  async allocateCosts(poId) {
    const po = await this.db
      .prepare(`SELECT * FROM purchase_orders WHERE id = ?`)
      .bind(poId)
      .first();
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

    // 批量更新分摊结果
    await this.repo.updateAllocations(allocations);

    const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
    const macUpdates = [];
    for (const item of items) {
      if (!item.variant_id) continue;
      const itemQty = getReceivedAllocationQty(item);
      if (itemQty <= 0) continue;

      const allocation = allocationById.get(item.id) || {};
      const unitCost = Number(item.unit_cost) || 0;
      const perUnitFreight = Number(allocation.allocated_freight) || 0;
      const perUnitTariff = Number(allocation.allocated_tariff) || 0;
      const itemTotalLandedCost = (unitCost + perUnitFreight + perUnitTariff) * itemQty;

      macUpdates.push(
        this.variantRepo.updateMovingAverageCost(item.variant_id, itemQty, itemTotalLandedCost)
      );
    }

    if (macUpdates.length > 0) {
      await Promise.all(macUpdates);
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

  // ─── 智能采购建议 (Demand-Driven Suggestion) ─────────

  /**
   * 获取建议采购清单
   * 基于订货总览中 shortage > 0 的变体，以及 status = 'confirmed' 的预订单
   *
   * @returns {Promise<Array>} 建议列表
   */
  async getSuggestions() {
    const demandRows = await this.demandService.getDemandSummaryByVariant();
    const variantIds = demandRows.map((row) => row.variant_id).filter(Boolean);
    if (variantIds.length === 0) {
      return [];
    }
    const rows = [];

    for (const variantIdChunk of chunkArray(variantIds, D1_MAX_IN_CLAUSE_SIZE)) {
      const placeholders = variantIdChunk.map(() => '?').join(',');
      const { results } = await this.db.prepare(`
        SELECT
          pv.id AS variant_id,
          p.id AS product_id,
          p.product_code AS product_code,
          pv.variant_code AS variant_code,
          p.name AS product_name,
          pv.sku AS sku,
          p.brand,
          COALESCE(pv.cost_price, 0) AS cost_price,
          COALESCE(pv.suggested_purchase_price, 0) AS suggested_purchase_price,
          COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
          COALESCE(ib.reserved, 0) AS reserved,
          COALESCE(ib.available, COALESCE(pv.stock_quantity, 0)) AS available,
          p.images,
          pv.options_values AS variant_options
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
        WHERE pv.id IN (${placeholders})
          AND pv.status = 'active'
      `).bind(...variantIdChunk).all();
      rows.push(...(results || []));
    }

    const demandByVariant = new Map(demandRows.map((row) => [row.variant_id, row]));
    const lastPurchasePriceMap = await this.repo.getLastPurchasePricesByVariant(variantIds);

    return rows
      .map((row) => {
        const demand = demandByVariant.get(row.variant_id) || {
          total_demand: 0,
          order_count: 0,
          order_ids: [],
        };
        const totalDemand = Number(demand.total_demand || 0);
        const { onHand, available } = resolveInventorySnapshot(row);
        const shortage = Math.max(totalDemand - available, 0);
        return {
          ...buildSuggestionPricing(row, lastPurchasePriceMap),
          variant_id: row.variant_id,
          product_id: row.product_id,
          product_code: row.product_code,
          variant_code: row.variant_code,
          product_name: row.product_name,
          sku: row.sku,
          brand: row.brand,
          cost_price: Number(row.cost_price) || 0,
          stock_quantity: onHand,
          available_quantity: available,
          total_demand: totalDemand,
          shortage,
          order_count: Number(demand.order_count || 0),
          order_ids: Array.isArray(demand.order_ids) ? demand.order_ids : [],
          images: parseJsonArray(row.images, []),
          variant_options: parseJsonObject(row.variant_options, {}),
          variant_display_name: buildVariantDisplayName(parseJsonObject(row.variant_options, {})),
        };
      })
      .filter((row) => row.shortage > 0)
      .sort((a, b) => b.shortage - a.shortage);
  }

  async createManual(poData = {}, items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('请提供至少一条明细项');
    }

    await validatePurchaseOrderVariantItems(this.db, items);
    await validatePurchaseOrderPreOrderBinding(this.db, items, { repo: this.repo });

    const po = await this.repo.create(poData);
    try {
      await this.repo.addItems(po.id, items);
    } catch (error) {
      if (typeof this.repo.deleteIfEmptyDraft === 'function') {
        try {
          await this.repo.deleteIfEmptyDraft(po.id);
        } catch (cleanupError) {
          console.error('Purchase-order draft cleanup failed:', cleanupError);
        }
      }
      throw error;
    }

    return this.repo.findById(po.id);
  }

  /**
   * 从预订单快速创建采购单
   * @param {string[]} orderIds - 预订单 ID 列表
   * @param {Object} poData - 采购单基本信息
   * @returns {Promise<Object>} 创建的采购单
   */
  async createFromOrders(orderIds, poData = {}) {
    // 1. 查询选中的订单及其关联变体
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestError('请至少选择一个预订单');
    }

    const uniqueOrderIds = [...new Set((orderIds || []).filter(Boolean))];
    if (uniqueOrderIds.length === 0) {
      throw new BadRequestError('请至少选择一个预订单');
    }

    const orders = [];
    for (const orderIdChunk of chunkArray(uniqueOrderIds, D1_MAX_IN_CLAUSE_SIZE)) {
      const placeholders = orderIdChunk.map(() => '?').join(',');
      const { results } = await this.db.prepare(`
        SELECT o.id, o.order_no, o.product_id, o.variant_id, o.quantity,
               p.name, pv.sku AS sku,
               COALESCE(pv.cost_price, 0) AS cost_price
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN product_variants pv ON pv.id = o.variant_id
        WHERE o.id IN (${placeholders})
          AND o.status = 'confirmed'
          AND o.product_id IS NOT NULL
          AND o.variant_id IS NOT NULL
          AND pv.status = 'active'
      `).bind(...orderIdChunk).all();
      orders.push(...(results || []));
    }

    const foundOrderIdSet = new Set(orders.map((order) => order.id).filter(Boolean));
    const missingOrderIds = uniqueOrderIds.filter((orderId) => !foundOrderIdSet.has(orderId));

    if (orders.length === 0) {
      throw new NotFoundError('未找到符合条件的已确认订单 (需为已确认状态且已绑定变体)');
    }
    if (missingOrderIds.length > 0) {
      throw new BadRequestError(`以下预订单不存在或已不再可采购: ${missingOrderIds.join(', ')}`);
    }

    const activeBindings = typeof this.repo.findActiveBindingsByPreOrderIds === 'function'
      ? await this.repo.findActiveBindingsByPreOrderIds(orders.map((order) => order.id))
      : [];
    if (activeBindings.length > 0) {
      const bindingByOrderId = new Map(activeBindings.map((binding) => [binding.pre_order_id, binding]));
      const firstConflictOrder = orders.find((order) => bindingByOrderId.has(order.id));
      const conflict = firstConflictOrder ? bindingByOrderId.get(firstConflictOrder.id) : activeBindings[0];
      const orderLabel = firstConflictOrder?.order_no || conflict?.pre_order_id;
      const poLabel = conflict?.po_no || conflict?.po_id;
      throw new BadRequestError(`${orderLabel} 已在采购单 ${poLabel} 中`);
    }

    // 2. 创建采购单
    const po = await this.repo.create(poData);

    // 3. 添加明细
    const items = orders.map(order => ({
      product_id: order.product_id,
      variant_id: order.variant_id,
      pre_order_id: order.id,
      quantity: order.quantity || 1,
      unit_cost: order.cost_price || 0,
    }));

    try {
      await this.repo.addItems(po.id, items);
    } catch (error) {
      if (typeof this.repo.deleteIfEmptyDraft === 'function') {
        try {
          await this.repo.deleteIfEmptyDraft(po.id);
        } catch (cleanupError) {
          console.error('Purchase-order draft cleanup failed:', cleanupError);
        }
      }
      throw error;
    }

    // 4. 返回完整的采购单
    return this.repo.findById(po.id);
  }

  // ─── 内部工具 ──────────────────────────────────────────

  /**
   * 批量更新商品库存（原子增减操作）
   * 使用 D1 batch 确保事务性，按 product_id 聚合数量
   *
   * @param {Array} items - 采购单明细 (含 product_id, quantity)
   * @param {'increment'|'decrement'} direction - 增 or 减
   *   - `increment` maps to `type === 'purchase_arrival'`
   *   - `decrement` maps to `type === 'manual_adjustment'` for corrections
   * @returns {Promise<{productCount: number, totalQty: number}>}
   */
  async _updateInventory(items, direction = 'increment', context = {}) {
    if (!items || items.length === 0) return { productCount: 0, totalQty: 0 };

    // 强制按 variant_id 聚合，禁止 product 级回退
    const variantStockChanges = {};
    for (const item of items) {
      if (item.variant_id) {
        variantStockChanges[item.variant_id] = (variantStockChanges[item.variant_id] || 0) + (item.quantity || 0);
      } else {
        throw new BadRequestError('variant_id is required for inventory updates');
      }
    }

    const type = direction === 'increment' ? 'purchase_arrival' : 'manual_adjustment';
    const multiplier = direction === 'increment' ? 1 : -1;
    const mutations = Object.entries(variantStockChanges).map(([variantId, qty]) => ({
      type,
      variantId,
      quantityDelta: qty * multiplier,
      referenceType: context.referenceType,
      referenceId: context.referenceId,
    }));
    return this.inventoryService.applyBatch(mutations);
  }
}
