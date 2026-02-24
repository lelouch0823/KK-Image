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
import { NotFoundError, BadRequestError } from '../lib/hono/errors.js';

/**
 * 采购单状态 → 预订单状态 映射
 * 当采购单状态变更时，自动联动更新关联的预订单状态
 */
const PO_TO_ORDER_STATUS_MAP = {
  ordered: 'production',    // 已下单 → 预订单变为 "生产中/采购中"
  shipping: 'shipping',     // 在途 → 预订单变为 "运输中"
  arrived: 'arrived',       // 已到货 → 预订单变为 "已到货"
};

export class PurchaseOrderService {
  /**
   * @param {D1Database} db
   */
  constructor(db) {
    this.db = db;
    this.repo = new PurchaseOrderRepository(db);
  }

  // ─── 状态机级联 (Cascading State Machine) ────────────

  /**
   * 变更采购单状态，并级联更新关联预订单
   * @param {string} poId - 采购单 ID
   * @param {string} newStatus - 目标状态
   * @returns {Promise<{success: boolean, cascadedOrders: number}>}
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

    // 2. 更新采购单状态
    await this.repo.updateStatus(poId, newStatus);

    // 3. 级联更新预订单状态
    let cascadedOrders = 0;
    const targetOrderStatus = PO_TO_ORDER_STATUS_MAP[newStatus];

    if (targetOrderStatus) {
      const linkedOrderIds = await this.repo.getLinkedOrderIds(poId);
      if (linkedOrderIds.length > 0) {
        const now = Date.now();
        const stmts = linkedOrderIds.map(orderId =>
          this.db.prepare(
            `UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status != ?`
          ).bind(targetOrderStatus, now, orderId, targetOrderStatus)
        );
        const results = await this.db.batch(stmts);
        cascadedOrders = results.filter(r => r.meta?.changes > 0).length;
      }
    }

    // 3.5 库存联动 — 采购单到货时自动入库
    let stockUpdated = 0;
    let totalStockAdded = 0;

    if (newStatus === 'arrived') {
      // 入库：按明细批量增加商品库存
      const result = await this._updateInventory(po.items, 'increment');
      stockUpdated = result.productCount;
      totalStockAdded = result.totalQty;
    }

    // 如果从 arrived 状态取消（极端回滚场景）
    if (newStatus === 'cancelled' && po.status === 'arrived') {
      await this._updateInventory(po.items, 'decrement');
    }

    // 4. 如果是结算完成，触发成本分摊
    if (newStatus === 'completed') {
      await this.allocateCosts(poId);
    }

    return { success: true, cascadedOrders, stockUpdated, totalStockAdded };
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

    // 优先使用实际费用，未填则使用预估费用
    const shippingCost = po.actual_shipping_cost ?? po.estimated_shipping_cost ?? 0;
    const tariffCost = po.actual_tariff_cost ?? po.estimated_tariff_cost ?? 0;

    if (shippingCost === 0 && tariffCost === 0) return;

    const items = await this.repo.getItemsForAllocation(poId);
    if (items.length === 0) return;

    let allocations;

    if (po.allocation_method === 'by_value') {
      // --- 按金额比例分摊 ---
      const totalValue = items.reduce((sum, item) => sum + (item.unit_cost * item.quantity), 0);

      if (totalValue === 0) {
        // 回退到按件数分摊
        allocations = this._allocateByQuantity(items, shippingCost, tariffCost);
      } else {
        allocations = items.map(item => {
          const valueRatio = (item.unit_cost * item.quantity) / totalValue;
          return {
            id: item.id,
            allocated_freight: Math.round(shippingCost * valueRatio / item.quantity * 100) / 100,
            allocated_tariff: Math.round(tariffCost * valueRatio / item.quantity * 100) / 100,
          };
        });
      }
    } else {
      // --- 按件数平均分摊 (默认) ---
      allocations = this._allocateByQuantity(items, shippingCost, tariffCost);
    }

    // 批量更新分摊结果
    await this.repo.updateAllocations(allocations);
  }

  /**
   * 按件数平均分摊
   */
  _allocateByQuantity(items, shippingCost, tariffCost) {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQty === 0) return [];

    const freightPerUnit = Math.round(shippingCost / totalQty * 100) / 100;
    const tariffPerUnit = Math.round(tariffCost / totalQty * 100) / 100;

    return items.map(item => ({
      id: item.id,
      allocated_freight: freightPerUnit,
      allocated_tariff: tariffPerUnit,
    }));
  }

  // ─── 智能采购建议 (Demand-Driven Suggestion) ─────────

  /**
   * 获取建议采购清单
   * 基于订货总览中 shortage > 0 的商品，以及 status = 'confirmed' 的预订单
   *
   * @returns {Promise<Array>} 建议列表
   */
  async getSuggestions() {
    // 获取有缺口的商品及关联的已确认订单
    const { results } = await this.db.prepare(`
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        p.brand,
        p.cost_price,
        p.stock_quantity,
        p.images,
        COALESCE(SUM(o.quantity), 0) AS total_demand,
        COALESCE(SUM(o.quantity), 0) - p.stock_quantity AS shortage,
        COUNT(o.id) AS order_count,
        GROUP_CONCAT(DISTINCT o.id) AS order_ids
      FROM orders o
      JOIN products p ON o.product_id = p.id AND p.status = 'active'
      WHERE o.status = 'confirmed'
        AND o.product_id IS NOT NULL
      GROUP BY p.id
      HAVING shortage > 0
      ORDER BY shortage DESC
    `).all();

    return results.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      sku: row.sku,
      brand: row.brand,
      cost_price: row.cost_price || 0,
      stock_quantity: row.stock_quantity,
      total_demand: row.total_demand,
      shortage: row.shortage,
      order_count: row.order_count,
      // 关联的预订单 ID 列表
      order_ids: row.order_ids ? row.order_ids.split(',') : [],
      images: this._parseJson(row.images),
    }));
  }

  /**
   * 从预订单快速创建采购单
   * @param {string[]} orderIds - 预订单 ID 列表
   * @param {Object} poData - 采购单基本信息
   * @returns {Promise<Object>} 创建的采购单
   */
  async createFromOrders(orderIds, poData = {}) {
    // 1. 查询选中的订单及其关联商品
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestError('请至少选择一个预订单');
    }

    const placeholders = orderIds.map(() => '?').join(',');
    const { results: orders } = await this.db.prepare(`
      SELECT o.id, o.order_no, o.product_id, o.quantity,
             p.name, p.sku, p.cost_price
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.id IN (${placeholders})
        AND o.status = 'confirmed'
        AND o.product_id IS NOT NULL
    `).bind(...orderIds).all();

    if (orders.length === 0) {
      throw new NotFoundError('未找到符合条件的已确认订单 (需为已确认状态且已绑定商品)');
    }

    // 2. 创建采购单
    const po = await this.repo.create(poData);

    // 3. 添加明细
    const items = orders.map(order => ({
      product_id: order.product_id,
      pre_order_id: order.id,
      quantity: order.quantity || 1,
      unit_cost: order.cost_price || 0,
    }));

    await this.repo.addItems(po.id, items);

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
   * @returns {Promise<{productCount: number, totalQty: number}>}
   */
  async _updateInventory(items, direction = 'increment') {
    if (!items || items.length === 0) return { productCount: 0, totalQty: 0 };

    // 按 product_id 聚合数量（同一商品可能出现在多条明细中）
    const stockChanges = {};
    for (const item of items) {
      if (!item.product_id) continue;
      stockChanges[item.product_id] = (stockChanges[item.product_id] || 0) + (item.quantity || 0);
    }

    const operator = direction === 'increment' ? '+' : '-';
    const now = Date.now();

    const stmts = Object.entries(stockChanges).map(([productId, qty]) =>
      this.db.prepare(
        `UPDATE products 
         SET stock_quantity = MAX(0, stock_quantity ${operator} ?), 
             updated_at = ? 
         WHERE id = ?`
      ).bind(qty, now, productId)
    );

    if (stmts.length > 0) {
      await this.db.batch(stmts);
    }

    return {
      productCount: Object.keys(stockChanges).length,
      totalQty: Object.values(stockChanges).reduce((a, b) => a + b, 0),
    };
  }

  _parseJson(str) {
    try {
      return typeof str === 'string' ? JSON.parse(str) : (str || []);
    } catch {
      return [];
    }
  }
}
