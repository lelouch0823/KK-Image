/**
 * 订单统计仓库 (Order Stats Repository)
 * ===================================
 *
 * 负责订单相关的统计查询，将统计逻辑从主 OrderRepository 中分离。
 */

import { parseJsonObject } from '../api/utils/json.js';
import { query, queryFirst } from '../lib/db/query.js';
import {
  ORDER_SUMMARY_EFFECTIVE_DELIVERY_STATUS_SQL,
  ORDER_SUMMARY_PROJECTION_JOIN,
} from './order/summary-projection.js';

export class OrderStatsRepository {
  constructor(db) {
    this.db = db;
  }

  async runQuery(sql, bindings = [], label) {
    return query(this.db, sql, bindings, { label });
  }

  async runQueryFirst(sql, bindings = [], label) {
    return queryFirst(this.db, sql, bindings, { label });
  }

  /**
   * 获取最近的待处理订单
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getRecentPending(limit = 5) {
    const result = await this.runQuery(
      `
            SELECT id, order_no, current_data, created_at, status 
            FROM orders 
            WHERE status = 'pending'
            ORDER BY created_at DESC 
            LIMIT ?
        `
      ,
      [limit],
      'order.stats.recentPending'
    );

    return result.results.map((order) => {
      const data = parseJsonObject(order.current_data, {});
      return {
        id: order.id,
        orderNo: order.order_no,
        name: data.name || '',
        createdAt: order.created_at,
        status: order.status,
      };
    });
  }

  /**
   * 统计指定时间之后创建的订单数
   * @param {number} timestamp
   * @returns {Promise<number>}
   */
  async countCreatedAfter(timestamp) {
    const result = await this.runQueryFirst(
      `
            SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
        `
      ,
      [timestamp],
      'order.stats.countCreatedAfter'
    );
    return result?.count || 0;
  }

  /**
   * 按状态统计订单数
   * @param {string} status
   * @returns {Promise<number>}
   */
  async countByStatus(status) {
    const result = await this.runQueryFirst(
      `
            SELECT COUNT(*) as count FROM orders WHERE status = ?
        `
      ,
      [status],
      'order.stats.countByStatus'
    );
    return result?.count || 0;
  }

  /**
   * 统计指定时间范围内创建的订单数
   * @param {number} startTimestamp - 开始时间戳 (包含)
   * @param {number} endTimestamp - 结束时间戳 (不包含)
   * @returns {Promise<number>}
   */
  async countCreatedBetween(startTimestamp, endTimestamp) {
    const result = await this.runQueryFirst(
      `
            SELECT COUNT(*) as count FROM orders 
            WHERE created_at >= ? AND created_at < ?
        `
      ,
      [startTimestamp, endTimestamp],
      'order.stats.countCreatedBetween'
    );
    return result?.count || 0;
  }

  /**
   * 获取销售员的订单统计
   * @param {string} salespersonId
   * @param {number} todayStart
   */
  async getSalesStats(salespersonId, todayStart) {
    const [totalResult, todayResult, pendingResult] = await Promise.all([
      this.runQueryFirst(
        `
                SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
            `
        ,
        [salespersonId],
        'order.stats.sales.total'
      ),
      this.runQueryFirst(
        `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
            `
        ,
        [salespersonId, todayStart],
        'order.stats.sales.today'
      ),
      this.runQueryFirst(
        `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND status = 'pending'
            `
        ,
        [salespersonId],
        'order.stats.sales.pending'
      ),
    ]);

    return {
      total: totalResult.count,
      today: todayResult.count,
      pending: pendingResult.count,
    };
  }

  /**
   * 获取销售员完整统计（含趋势）
   * @param {string} salespersonId
   * @param {number} monthStart
   */
  async getSalesFullStats(salespersonId, monthStart) {
    const [totalResult, completedResult, monthResult, trendResult] = await Promise.all([
      // 累计订单
      this.runQueryFirst(
        `
                SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
            `
        ,
        [salespersonId],
        'order.stats.salesFull.total'
      ),
      // 已完成订单
      this.runQueryFirst(
        `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND status IN ('fulfilled', 'delivered')
            `
        ,
        [salespersonId],
        'order.stats.salesFull.completed'
      ),
      // 本月订单
      this.runQueryFirst(
        `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
            `
        ,
        [salespersonId, monthStart],
        'order.stats.salesFull.month'
      ),
      // 近30天趋势
      this.runQuery(
        `
                SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count
                FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
                GROUP BY DATE(created_at / 1000, 'unixepoch', '+8 hours')
                ORDER BY date ASC
            `
        ,
        [salespersonId, monthStart],
        'order.stats.salesFull.trend'
      ),
    ]);

    return {
      total: totalResult.count,
      completed: completedResult.count,
      month: monthResult.count,
      trend: trendResult.results,
    };
  }

  /**
   * 获取管理端订单统计（含状态分布）
   * @param {number} todayStart
   * @param {number} weekStart
   * @param {number} monthStart
   */
  async getAdminStats(todayStart, weekStart, monthStart) {
    const [
      todayResult,
      weekResult,
      monthResult,
      statusDistribution,
      deliveryStatusDistribution,
      awaitingDeliveryResult,
      recentTrend,
    ] =
      await Promise.all([
        this.runQueryFirst(
          `
                SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
            `
          ,
          [todayStart],
          'order.stats.admin.today'
        ),
        this.runQueryFirst(
          `
                SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
            `
          ,
          [weekStart],
          'order.stats.admin.week'
        ),
        this.runQueryFirst(
          `
                SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
            `
          ,
          [monthStart],
          'order.stats.admin.month'
        ),
        this.runQuery(
          `
                SELECT status, COUNT(*) as count FROM orders GROUP BY status
            `
          ,
          [],
          'order.stats.admin.statusDistribution'
        ),
        this.runQuery(
          `
                SELECT ${ORDER_SUMMARY_EFFECTIVE_DELIVERY_STATUS_SQL} as status, COUNT(*) as count
                FROM orders o
                ${ORDER_SUMMARY_PROJECTION_JOIN}
                GROUP BY ${ORDER_SUMMARY_EFFECTIVE_DELIVERY_STATUS_SQL}
            `
          ,
          [],
          'order.stats.admin.deliveryStatusDistribution'
        ),
        this.runQueryFirst(
          `
                SELECT COUNT(*) as count
                FROM (
                    SELECT
                      LOWER(TRIM(COALESCE(o.status, ''))) AS normalized_status,
                      ${ORDER_SUMMARY_EFFECTIVE_DELIVERY_STATUS_SQL} AS effective_delivery_status
                    FROM orders o
                    ${ORDER_SUMMARY_PROJECTION_JOIN}
                )
                WHERE normalized_status IN ('fulfilled', 'delivered')
                  AND effective_delivery_status = 'in_transit'
            `
          ,
          [],
          'order.stats.admin.awaitingDelivery'
        ),
        this.runQuery(
          `
                SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count
                FROM orders 
                WHERE created_at >= ?
                GROUP BY date ORDER BY date
            `
          ,
          [monthStart],
          'order.stats.admin.recentTrend'
        ),
      ]);
    return {
      today: todayResult.count,
      week: weekResult.count,
      month: monthResult.count,
      statusDistribution: statusDistribution.results.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {}),
      deliveryStatusDistribution: deliveryStatusDistribution.results.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {}),
      awaitingDelivery: awaitingDeliveryResult.count,
      delivered: deliveryStatusDistribution.results.find((row) => row.status === 'delivered')?.count || 0,
      partiallyReturned: deliveryStatusDistribution.results.find((row) => row.status === 'partially_returned')?.count || 0,
      returned: deliveryStatusDistribution.results.find((row) => row.status === 'returned')?.count || 0,
      recentTrend: recentTrend.results,
    };
  }

  /**
   * 获取今日每小时订单趋势
   * @param {number} todayStart
   */
  async getTodayHourlyTrend(todayStart) {
    const result = await this.runQuery(
      `
            SELECT STRFTIME('%H', created_at / 1000, 'unixepoch', '+8 hours') as hour, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= ?
            GROUP BY hour
            ORDER BY hour ASC
        `
      ,
      [todayStart],
      'order.stats.todayHourlyTrend'
    );
    return result.results;
  }

  /**
   * 获取过去7天订单趋势
   * @param {number} startTimestamp
   */
  async getLast7DaysOrderTrend(startTimestamp) {
    const result = await this.runQuery(
      `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= ?
            GROUP BY date
            ORDER BY date ASC
        `
      ,
      [startTimestamp],
      'order.stats.last7DaysOrderTrend'
    );
    return result.results;
  }

  /**
   * 获取过去7天待处理订单趋势 (实际是新创建的订单中处于Pending状态的，或者所有新创建的Pending，这里按创建时间统计Pending订单)
   * 另一种解读是：每天处于Pending状态的快照（无法回溯）。
   * 采用方案：统计每天创建的且当前仍是 Pending 的订单 (或者创建时是Pending -> 也就是所有创建的订单).
   * 修正：为了展示"待处理负载"，展示每天新产生的"待处理"订单。
   */
  async getLast7DaysPendingTrend(startTimestamp) {
    const result = await this.runQuery(
      `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= ? AND status = 'pending'
            GROUP BY date
            ORDER BY date ASC
        `
      ,
      [startTimestamp],
      'order.stats.last7DaysPendingTrend'
    );
    return result.results;
  }

  /**
   * 获取过去7天分享链接创建趋势
   * (虽然是 FolderRepository 的职责，但为了 Dashboard 便捷，暂时放在这里)
   * @param {number} startTimestamp
   */
  async getLast7DaysShareTrend(startTimestamp) {
    const result = await this.runQuery(
      `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count 
            FROM folders 
            WHERE is_public = 1 AND created_at >= ?
            GROUP BY date
            ORDER BY date ASC
        `
      ,
      [startTimestamp],
      'order.stats.last7DaysShareTrend'
    );
    return result.results;
  }

  /**
   * 获取销售趋势（每日订单数）
   * @param {number} startTimestamp - 开始时间戳
   * @returns {Promise<Array<{date: string, orderCount: number}>>}
   */
  async getSalesTrend(startTimestamp) {
    const result = await this.runQuery(
      `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date,
                   COUNT(*) as orderCount
            FROM orders
            WHERE created_at >= ?
            GROUP BY date
            ORDER BY date ASC
        `,
      [startTimestamp],
      'order.stats.salesTrend'
    );
    return result.results;
  }

  /**
   * 获取订单状态分布
   * @returns {Promise<Array<{status: string, count: number}>>}
   */
  async getStatusDistribution() {
    const result = await this.runQuery(
      `
            SELECT status, COUNT(*) as count
            FROM orders
            GROUP BY status
            ORDER BY count DESC
        `,
      [],
      'order.stats.statusDistribution'
    );
    return result.results;
  }

  /**
   * 获取热销商品排行（按订单行数统计）
   * @param {number} limit - 返回数量
   * @returns {Promise<Array<{productName: string, orderCount: number}>>}
   */
  async getTopProducts(limit = 10) {
    const result = await this.runQuery(
      `
            SELECT snapshot_name as productName,
                   COUNT(*) as orderCount,
                   SUM(ordered_qty) as totalQty
            FROM order_lines
            WHERE snapshot_name IS NOT NULL AND snapshot_name != ''
            GROUP BY snapshot_name
            ORDER BY orderCount DESC
            LIMIT ?
        `,
      [limit],
      'order.stats.topProducts'
    );
    return result.results;
  }

  /**
   * 获取销售员业绩统计（按订单数）
   * @returns {Promise<Array<{name: string, orderCount: number}>>}
   */
  async getSalespersonStats() {
    const result = await this.runQuery(
      `
            SELECT COALESCE(s.name, '未知') as name,
                   COUNT(*) as orderCount
            FROM orders o
            LEFT JOIN salespersons s ON s.id = o.salesperson_id
            GROUP BY o.salesperson_id
            ORDER BY orderCount DESC
        `,
      [],
      'order.stats.salespersonStats'
    );
    return result.results;
  }
}
