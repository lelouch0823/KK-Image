/**
 * 利润数据仓库 (Profit Repository)
 * ===================================
 *
 * 封装利润核算所需的 SQL 查询，供 ProfitService 调用。
 *
 * @module repositories/ProfitRepository
 */

import { chinaDateExprAliased } from '../lib/db/date-sql.js';
import { query } from '../lib/db/query.js';

export class ProfitRepository {
  /** @param {D1Database} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * 查询单个订单的行级利润数据
   * @param {string} orderId
   * @returns {Promise<Array>}
   */
  async findOrderLinesForProfit(orderId) {
    const { results } = await query(
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
    return results || [];
  }

  /**
   * 查询多订单的行级利润数据（用于统计）
   * @param {Object} [filters]
   * @param {number} [filters.startTimestamp]
   * @param {number} [filters.endTimestamp]
   * @param {string} [filters.status]
   * @returns {Promise<Array>}
   */
  async findOrderLinesForProfitSummary(filters = {}) {
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
    return results || [];
  }

  /**
   * 查询商品维度利润数据
   * @param {Object} [filters]
   * @returns {Promise<Array>}
   */
  async findOrderLinesForProfitByProduct(filters = {}) {
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
    return results || [];
  }

  /**
   * 查询利润趋势数据（按日）
   * @param {number} startTimestamp
   * @returns {Promise<Array>}
   */
  async findOrderLinesForProfitTrend(startTimestamp) {
    const { results } = await query(
      this.db,
      `
      SELECT
        ${chinaDateExprAliased('o')} AS date,
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
    return results || [];
  }
}
