/**
 * 利润核算服务 (Profit Service)
 * =============================
 *
 * 基于采购成本计算订单利润，支持：
 * - 单订单利润明细（order detail）
 * - 全局利润统计（stats）
 *
 * 成本来源优先级：
 * 1. 采购单明细 unit_cost + allocated_freight + allocated_tariff
 * 2. 商品变体 cost_price（兜底）
 * 3. 无成本数据时标记"成本未录入"
 *
 * @module services/ProfitService
 */

import { query } from '../lib/db/query.js';

/**
 * @typedef {Object} LineProfit
 * @property {string} orderLineId - 订单行 ID
 * @property {string} productName - 商品名称
 * @property {number} quantity - 数量
 * @property {number|null} unitPrice - 单件售价
 * @property {number|null} unitCost - 单件成本
 * @property {number} revenue - 行收入
 * @property {number} cost - 行成本
 * @property {number} profit - 行利润
 * @property {number|null} margin - 利润率 (%)
 * @property {'po'|'variant'|'missing'} costSource - 成本来源
 */

/**
 * @typedef {Object} OrderProfit
 * @property {number} revenue - 总收入
 * @property {number} cost - 总成本
 * @property {number} profit - 总利润
 * @property {number|null} margin - 利润率 (%)
 * @property {boolean} costComplete - 是否所有行都有成本数据
 * @property {LineProfit[]} lines - 行级利润明细
 */

export class ProfitService {
  /**
   * @param {D1Database} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 计算单个订单的利润
   * @param {string} orderId
   * @returns {Promise<OrderProfit>}
   */
  async calculateOrderProfit(orderId) {
    // 查询订单行及其关联的商品变体售价、采购成本
    const { results: lines } = await query(
      this.db,
      `
      SELECT
        ol.id AS order_line_id,
        ol.snapshot_name,
        ol.ordered_qty,
        ol.product_id,
        ol.variant_id,
        pv.price AS variant_price,
        pv.cost_price AS variant_cost_price,
        -- 采购单成本：取该订单行关联的最近一条采购明细
        poi.unit_cost AS po_unit_cost,
        poi.allocated_freight AS po_freight,
        poi.allocated_tariff AS po_tariff
      FROM order_lines ol
      LEFT JOIN product_variants pv ON pv.id = ol.variant_id
      LEFT JOIN purchase_order_items poi ON poi.pre_order_id = ol.order_id
        AND poi.product_id = ol.product_id
        AND (poi.variant_id = ol.variant_id OR (poi.variant_id IS NULL AND ol.variant_id IS NULL))
      WHERE ol.order_id = ?
      ORDER BY ol.created_at ASC
      `,
      [orderId],
      { label: 'profit.order.lines' }
    );

    return this._aggregateLinesProfit(lines);
  }

  /**
   * 批量计算多个订单的利润（用于统计）
   * @param {Object} [filters]
   * @param {number} [filters.startTimestamp] - 起始时间戳
   * @param {number} [filters.endTimestamp] - 截止时间戳
   * @param {string} [filters.status] - 订单状态筛选
   * @returns {Promise<{totalRevenue: number, totalCost: number, totalProfit: number, margin: number|null, orderCount: number, costCompleteOrderCount: number}>}
   */
  async calculateProfitSummary(filters = {}) {
    let whereClause = '1=1';
    const params = [];

    if (filters.startTimestamp) {
      whereClause += ' AND o.created_at >= ?';
      params.push(filters.startTimestamp);
    }
    if (filters.endTimestamp) {
      whereClause += ' AND o.created_at <= ?';
      params.push(filters.endTimestamp);
    }
    if (filters.status) {
      whereClause += ' AND o.status = ?';
      params.push(filters.status);
    }

    const { results } = await query(
      this.db,
      `
      SELECT
        o.id AS order_id,
        ol.id AS order_line_id,
        ol.ordered_qty,
        ol.product_id,
        ol.variant_id,
        pv.price AS variant_price,
        pv.cost_price AS variant_cost_price,
        poi.unit_cost AS po_unit_cost,
        poi.allocated_freight AS po_freight,
        poi.allocated_tariff AS po_tariff
      FROM orders o
      INNER JOIN order_lines ol ON ol.order_id = o.id
      LEFT JOIN product_variants pv ON pv.id = ol.variant_id
      LEFT JOIN purchase_order_items poi ON poi.pre_order_id = ol.order_id
        AND poi.product_id = ol.product_id
        AND (poi.variant_id = ol.variant_id OR (poi.variant_id IS NULL AND ol.variant_id IS NULL))
      WHERE ${whereClause}
      `,
      params,
      { label: 'profit.summary.lines' }
    );

    // 按订单分组计算
    const orderMap = new Map();
    for (const row of results) {
      if (!orderMap.has(row.order_id)) orderMap.set(row.order_id, []);
      orderMap.get(row.order_id).push(row);
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let costCompleteOrders = 0;

    for (const [, orderLines] of orderMap) {
      const orderProfit = this._aggregateLinesProfit(orderLines);
      totalRevenue += orderProfit.revenue;
      totalCost += orderProfit.cost;
      if (orderProfit.costComplete) costCompleteOrders++;
    }

    const totalProfit = totalRevenue - totalCost;
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      margin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : null,
      orderCount: orderMap.size,
      costCompleteOrderCount: costCompleteOrders,
    };
  }

  /**
   * 按商品维度统计利润（用于 Top Products 利润排行）
   * @param {number} [limit=10]
   * @param {Object} [filters]
   * @returns {Promise<Array<{productName: string, revenue: number, cost: number, profit: number, margin: number|null, orderCount: number}>>}
   */
  async getProfitByProduct(limit = 10, filters = {}) {
    let whereClause = '1=1';
    const params = [];

    if (filters.startTimestamp) {
      whereClause += ' AND o.created_at >= ?';
      params.push(filters.startTimestamp);
    }
    if (filters.endTimestamp) {
      whereClause += ' AND o.created_at <= ?';
      params.push(filters.endTimestamp);
    }

    const { results } = await query(
      this.db,
      `
      SELECT
        ol.snapshot_name AS product_name,
        ol.ordered_qty,
        ol.product_id,
        ol.variant_id,
        pv.price AS variant_price,
        pv.cost_price AS variant_cost_price,
        poi.unit_cost AS po_unit_cost,
        poi.allocated_freight AS po_freight,
        poi.allocated_tariff AS po_tariff
      FROM orders o
      INNER JOIN order_lines ol ON ol.order_id = o.id
      LEFT JOIN product_variants pv ON pv.id = ol.variant_id
      LEFT JOIN purchase_order_items poi ON poi.pre_order_id = ol.order_id
        AND poi.product_id = ol.product_id
        AND (poi.variant_id = ol.variant_id OR (poi.variant_id IS NULL AND ol.variant_id IS NULL))
      WHERE ${whereClause}
      `,
      params,
      { label: 'profit.byProduct.lines' }
    );

    // 按商品名称分组
    const productMap = new Map();
    for (const row of results) {
      const key = row.product_name || '未知商品';
      if (!productMap.has(key)) {
        productMap.set(key, { productName: key, revenue: 0, cost: 0, orderLineCount: 0 });
      }
      const entry = productMap.get(key);
      const qty = Number(row.ordered_qty) || 0;
      const unitPrice = this._resolveUnitPrice(row);
      const unitCost = this._resolveUnitCost(row);

      entry.revenue += qty * unitPrice;
      if (unitCost !== null) {
        entry.cost += qty * unitCost;
      }
      entry.orderLineCount++;
    }

    return [...productMap.values()]
      .map((entry) => ({
        productName: entry.productName,
        revenue: Math.round(entry.revenue * 100) / 100,
        cost: Math.round(entry.cost * 100) / 100,
        profit: Math.round((entry.revenue - entry.cost) * 100) / 100,
        margin: entry.revenue > 0
          ? Math.round(((entry.revenue - entry.cost) / entry.revenue) * 10000) / 100
          : null,
        orderCount: entry.orderLineCount,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, limit);
  }

  /**
   * 利润趋势（按日）
   * @param {number} startTimestamp
   * @returns {Promise<Array<{date: string, revenue: number, cost: number, profit: number}>>}
   */
  async getProfitTrend(startTimestamp) {
    const { results } = await query(
      this.db,
      `
      SELECT
        DATE(o.created_at / 1000, 'unixepoch', '+8 hours') AS date,
        ol.ordered_qty,
        ol.product_id,
        ol.variant_id,
        pv.price AS variant_price,
        pv.cost_price AS variant_cost_price,
        poi.unit_cost AS po_unit_cost,
        poi.allocated_freight AS po_freight,
        poi.allocated_tariff AS po_tariff
      FROM orders o
      INNER JOIN order_lines ol ON ol.order_id = o.id
      LEFT JOIN product_variants pv ON pv.id = ol.variant_id
      LEFT JOIN purchase_order_items poi ON poi.pre_order_id = ol.order_id
        AND poi.product_id = ol.product_id
        AND (poi.variant_id = ol.variant_id OR (poi.variant_id IS NULL AND ol.variant_id IS NULL))
      WHERE o.created_at >= ?
      `,
      [startTimestamp],
      { label: 'profit.trend.lines' }
    );

    // 按日期分组
    const dateMap = new Map();
    for (const row of results) {
      const date = row.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, revenue: 0, cost: 0 });
      }
      const entry = dateMap.get(date);
      const qty = Number(row.ordered_qty) || 0;
      const unitPrice = this._resolveUnitPrice(row);
      const unitCost = this._resolveUnitCost(row);

      entry.revenue += qty * unitPrice;
      if (unitCost !== null) {
        entry.cost += qty * unitCost;
      }
    }

    return [...dateMap.values()]
      .map((entry) => ({
        date: entry.date,
        revenue: Math.round(entry.revenue * 100) / 100,
        cost: Math.round(entry.cost * 100) / 100,
        profit: Math.round((entry.revenue - entry.cost) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============ 私有方法 ============

  /**
   * 解析单件售价
   * @param {Object} row
   * @returns {number}
   * @private
   */
  _resolveUnitPrice(row) {
    return Number(row.variant_price) || 0;
  }

  /**
   * 解析单件成本（优先采购单，兜底变体 cost_price）
   * @param {Object} row
   * @returns {number|null} 返回 null 表示无成本数据
   * @private
   */
  _resolveUnitCost(row) {
    // 优先采购单成本
    const poUnitCost = Number(row.po_unit_cost) || 0;
    const poFreight = Number(row.po_freight) || 0;
    const poTariff = Number(row.po_tariff) || 0;
    const poTotal = poUnitCost + poFreight + poTariff;
    if (poTotal > 0) return poTotal;

    // 兜底：变体 cost_price
    const variantCost = Number(row.variant_cost_price);
    if (Number.isFinite(variantCost) && variantCost > 0) return variantCost;

    // 无成本数据
    return null;
  }

  /**
   * 聚合订单行利润
   * @param {Array} lines
   * @returns {OrderProfit}
   * @private
   */
  _aggregateLinesProfit(lines) {
    let totalRevenue = 0;
    let totalCost = 0;
    let allHaveCost = true;
    const lineProfits = [];

    for (const line of lines) {
      const qty = Number(line.ordered_qty) || 0;
      const unitPrice = this._resolveUnitPrice(line);
      const unitCost = this._resolveUnitCost(line);
      const revenue = qty * unitPrice;
      const cost = unitCost !== null ? qty * unitCost : 0;
      const profit = revenue - cost;

      let costSource = 'missing';
      if (Number(line.po_unit_cost) > 0 || Number(line.po_freight) > 0 || Number(line.po_tariff) > 0) {
        costSource = 'po';
      } else if (Number(line.variant_cost_price) > 0) {
        costSource = 'variant';
      }

      if (unitCost === null) allHaveCost = false;

      lineProfits.push({
        orderLineId: line.order_line_id,
        productName: line.snapshot_name || '',
        quantity: qty,
        unitPrice: unitPrice > 0 ? unitPrice : null,
        unitCost,
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : null,
        costSource,
      });

      totalRevenue += revenue;
      totalCost += cost;
    }

    const totalProfit = totalRevenue - totalCost;
    return {
      revenue: Math.round(totalRevenue * 100) / 100,
      cost: Math.round(totalCost * 100) / 100,
      profit: Math.round(totalProfit * 100) / 100,
      margin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : null,
      costComplete: allHaveCost,
      lines: lineProfits,
    };
  }
}
