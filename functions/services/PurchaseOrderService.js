/**
 * 采购单业务服务 (Purchase Order Service)
 * =========================================
 *
 * 核心业务逻辑层，封装：
 * 1. 状态机级联 (Cascading State Machine) — 采购单状态变更时自动流转预订单
 * 2. 动态成本分摊 (Cost Allocation) — 委托 CostAllocationService
 * 3. 智能建议采购 — 委托 PurchaseSuggestionService
 *
 * @module services/PurchaseOrderService
 */

import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { VariantDemandProjectionRepository } from '../repositories/VariantDemandProjectionRepository.js';
import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { NotFoundError, BadRequestError } from '../lib/hono/errors.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { InventoryService } from './InventoryService.js';
import { DemandService } from './DemandService.js';
import { CostAllocationService } from './CostAllocationService.js';
import { PurchaseSuggestionService } from './PurchaseSuggestionService.js';
import {
  validatePurchaseOrderPreOrderBinding,
  validatePurchaseOrderVariantItems,
} from './purchase-order-item-validation.js';
import {
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from './purchase-order-projection.js';
import { D1_MAX_IN_CLAUSE_SIZE } from '../api/utils/constants.js';

function buildPurchaseOrderShell(po = {}, items = []) {
  return {
    ...po,
    items: Array.isArray(items)
      ? items.map((item) => {
          const snapshotSpecs = parseJsonObject(item.snapshot_specs, {});
          return {
            ...item,
            product_name: item.snapshot_name || item.product_name || '',
            product_brand: snapshotSpecs.brand || item.product_brand || '',
            variant_sku: item.snapshot_sku || item.variant_sku || '',
            product_images: item.snapshot_image
              ? [item.snapshot_image]
              : parseJsonArray(item.product_images, []),
            variant_options: parseJsonObject(item.variant_options, {}),
          };
        })
      : [],
    receipts: [],
  };
}

function normalizePurchaseOrderSnapshotSpecs(rawSnapshotSpecs = {}) {
  const snapshotSpecs = parseJsonObject(rawSnapshotSpecs, {});
  return JSON.stringify({
    brand: snapshotSpecs.brand || '',
    size: snapshotSpecs.size || '',
    color: snapshotSpecs.color || '',
    material: snapshotSpecs.material || '',
    series: snapshotSpecs.series || '',
  });
}

function buildPurchaseOrderSnapshotSpecsFromData(data = {}) {
  if (!data || typeof data !== 'object') return {};

  return {
    brand: data.brand || '',
    size: data.size || '',
    color: data.color || '',
    material: data.material || '',
    series: data.series || '',
  };
}

function resolveCreateFromOrdersSnapshot(order = {}) {
  const currentData = parseJsonObject(order.current_data, {});
  const originalData = parseJsonObject(order.original_data, {});
  const persistedSnapshotSpecs = parseJsonObject(order.snapshot_specs, {});
  const mergedSnapshotSpecs = {
    ...buildPurchaseOrderSnapshotSpecsFromData(originalData),
    ...buildPurchaseOrderSnapshotSpecsFromData(currentData),
    ...persistedSnapshotSpecs,
  };

  return {
    snapshot_name: order.snapshot_name || currentData.name || originalData.name || order.name || '',
    snapshot_sku:
      order.snapshot_sku ||
      currentData.sku ||
      currentData.variant_sku ||
      currentData.spu ||
      originalData.sku ||
      originalData.variant_sku ||
      originalData.spu ||
      order.sku ||
      '',
    snapshot_specs: normalizePurchaseOrderSnapshotSpecs(mergedSnapshotSpecs),
    snapshot_image: order.snapshot_image || order.main_image_id || null,
  };
}

export class PurchaseOrderService {
  /**
   * @param {D1Database} db
   * @param {Object} deps - 依赖注入（可选，用于测试替换）
   * @param {CostAllocationService} [deps.costAllocationService]
   * @param {PurchaseSuggestionService} [deps.purchaseSuggestionService]
   */
  constructor(db, deps = {}) {
    this.db = db;
    this.repo = deps.repo || new PurchaseOrderRepository(db);
    this.variantRepo = deps.variantRepo || new ProductVariantRepository(db);
    this.inventoryService = deps.inventoryService || new InventoryService(db, this.variantRepo);
    this.demandService = deps.demandService || new DemandService(db);
    this.demandProjectionRepo =
      deps.demandProjectionRepo || new VariantDemandProjectionRepository(db);

    // 子服务注入（支持外部覆盖，方便测试）
    this.costAllocationService =
      deps.costAllocationService ||
      new CostAllocationService(db, {
        repo: this.repo,
        variantRepo: this.variantRepo,
      });
    this.purchaseSuggestionService =
      deps.purchaseSuggestionService ||
      new PurchaseSuggestionService(db, {
        demandProjectionRepo: this.demandProjectionRepo,
        repo: this.repo,
      });
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
      throw new BadRequestError(
        `无法从 "${po.status}" 转换到 "${newStatus}"。允许的目标状态: ${allowed.join(', ')}`
      );
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
    const updated =
      typeof this.repo.updateStatusIfCurrent === 'function'
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
        try {
          for (const orderIdChunk of chunkArray(linkedOrderIds, D1_MAX_IN_CLAUSE_SIZE)) {
            const stmts = orderIdChunk.map((orderId) =>
              this.db
                .prepare(
                  `UPDATE orders
                 SET procurement_status = ?, updated_at = ?
                 WHERE id = ?
                   AND archived_at IS NULL
                   AND status NOT IN ('fulfilled', 'delivered', 'void')
                   AND COALESCE(procurement_status, 'none') = 'none'`
                )
                .bind(targetProcurementStatus, now, orderId)
            );
            const results = await this.db.batch(stmts);
            const changedChunkIds = orderIdChunk.filter(
              (_orderId, index) => (results[index]?.meta?.changes || 0) > 0
            );
            cascadedOrders += changedChunkIds.length;
            changedOrderIds.push(...changedChunkIds);
          }
        } catch (error) {
          if (changedOrderIds.length > 0) {
            const rollbackNow = Date.now();
            const rollbackStatements = changedOrderIds.map((orderId) =>
              this.db
                .prepare(
                  `UPDATE orders
                 SET procurement_status = ?, updated_at = ?
                 WHERE id = ?
                   AND archived_at IS NULL
                   AND status NOT IN ('fulfilled', 'delivered', 'void')
                   AND COALESCE(procurement_status, 'none') = ?`
                )
                .bind('none', rollbackNow, orderId, targetProcurementStatus)
            );
            await executeBatchChunks(this.db, rollbackStatements);
          }
          await this.repo.updateStatusIfCurrent(poId, newStatus, po.status);
          throw error;
        }

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

  // ─── 动态成本分摊 (委托 CostAllocationService) ────────

  /**
   * 分摊运费和关税到各明细项（委托 CostAllocationService）
   * @param {string} poId
   */
  async allocateCosts(poId) {
    return this.costAllocationService.allocateCosts(poId);
  }

  // ─── 智能采购建议 (委托 PurchaseSuggestionService) ────

  /**
   * 获取建议采购清单（委托 PurchaseSuggestionService）
   * @returns {Promise<Array>} 建议列表
   */
  async getSuggestions() {
    return this.purchaseSuggestionService.getSuggestions();
  }

  // ─── 创建采购单 ─────────────────────────────────────

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

    return (await this.repo.findById(po.id)) || buildPurchaseOrderShell(po, items);
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
    const snapshotScopedChunkSize = Math.max(1, Math.floor(D1_MAX_IN_CLAUSE_SIZE / 2));
    for (const orderIdChunk of chunkArray(uniqueOrderIds, snapshotScopedChunkSize)) {
      const placeholders = orderIdChunk.map(() => '?').join(',');
      const { results } = await this.db
        .prepare(
          `
        SELECT o.id, o.order_no, ol.order_line_id, ol.product_id, ol.variant_id, ol.quantity,
               o.current_data, o.original_data, o.main_image_id,
               p.name, pv.sku AS sku,
               COALESCE(pv.cost_price, 0) AS cost_price,
               ol.snapshot_name,
               ol.snapshot_sku,
               ol.snapshot_specs,
               ol.snapshot_image
        FROM orders o
        JOIN (
          SELECT
            ol.id AS order_line_id,
            order_id,
            product_id,
            variant_id,
            MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) AS quantity,
            ol.snapshot_name,
            ol.snapshot_sku,
            ol.snapshot_specs,
            ol.snapshot_image
          FROM order_lines ol
          WHERE order_id IN (${placeholders})
            AND ol.product_id IS NOT NULL
            AND ol.variant_id IS NOT NULL
        ) ol ON ol.order_id = o.id
        LEFT JOIN products p ON ol.product_id = p.id
        LEFT JOIN product_variants pv ON pv.id = ol.variant_id
        WHERE o.id IN (${placeholders})
          AND o.archived_at IS NULL
          AND o.status = 'confirmed'
          AND ol.quantity > 0
      `
        )
        .bind(...orderIdChunk, ...orderIdChunk)
        .all();
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

    const activeBindings =
      typeof this.repo.findActiveBindingsByPreOrderIds === 'function'
        ? await this.repo.findActiveBindingsByPreOrderIds(orders.map((order) => order.id))
        : [];
    if (activeBindings.length > 0) {
      const bindingByOrderId = new Map(
        activeBindings.map((binding) => [binding.pre_order_id, binding])
      );
      const firstConflictOrder = orders.find((order) => bindingByOrderId.has(order.id));
      const conflict = firstConflictOrder
        ? bindingByOrderId.get(firstConflictOrder.id)
        : activeBindings[0];
      const orderLabel = firstConflictOrder?.order_no || conflict?.pre_order_id;
      const poLabel = conflict?.po_no || conflict?.po_id;
      throw new BadRequestError(`${orderLabel} 已在采购单 ${poLabel} 中`);
    }

    // 2. 创建采购单
    const po = await this.repo.create(poData);

    // 3. 添加明细
    const items = orders.map((order) => ({
      product_id: order.product_id,
      variant_id: order.variant_id,
      pre_order_id: order.id,
      order_line_id: order.order_line_id || null,
      quantity: order.quantity || 1,
      unit_cost: order.cost_price || 0,
      ...resolveCreateFromOrdersSnapshot(order),
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
    return (await this.repo.findById(po.id)) || buildPurchaseOrderShell(po, items);
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
        variantStockChanges[item.variant_id] =
          (variantStockChanges[item.variant_id] || 0) + (item.quantity || 0);
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
