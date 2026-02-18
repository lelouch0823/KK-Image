/**
 * 订单统计仓库 (Order Stats Repository)
 * ===================================
 *
 * 负责订单相关的统计查询，将统计逻辑从主 OrderRepository 中分离。
 */

import { parseJson } from './order/helpers.js';

export class OrderStatsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取最近的待处理订单
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getRecentPending(limit = 5) {
    const result = await this.db
      .prepare(
        `
            SELECT id, order_no, current_data, created_at, status 
            FROM orders 
            WHERE status = 'pending'
            ORDER BY created_at DESC 
            LIMIT ?
        `
      )
      .bind(limit)
      .all();

    return result.results.map((order) => {
      const data = parseJson(order.current_data);
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
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
        `
      )
      .bind(timestamp)
      .first();
    return result.count;
  }

  /**
   * 按状态统计订单数
   * @param {string} status
   * @returns {Promise<number>}
   */
  async countByStatus(status) {
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders WHERE status = ?
        `
      )
      .bind(status)
      .first();
    return result.count;
  }

  /**
   * 统计指定时间范围内创建的订单数
   * @param {number} startTimestamp - 开始时间戳 (包含)
   * @param {number} endTimestamp - 结束时间戳 (不包含)
   * @returns {Promise<number>}
   */
  async countCreatedBetween(startTimestamp, endTimestamp) {
    const result = await this.db
      .prepare(
        `
            SELECT COUNT(*) as count FROM orders 
            WHERE created_at >= ? AND created_at < ?
        `
      )
      .bind(startTimestamp, endTimestamp)
      .first();
    return result.count;
  }

  /**
   * 获取销售员的订单统计
   * @param {string} salespersonId
   * @param {number} todayStart
   */
  async getSalesStats(salespersonId, todayStart) {
    const [totalResult, todayResult, pendingResult] = await Promise.all([
      this.db
        .prepare(
          `
                SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
            `
        )
        .bind(salespersonId)
        .first(),
      this.db
        .prepare(
          `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
            `
        )
        .bind(salespersonId, todayStart)
        .first(),
      this.db
        .prepare(
          `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND status = 'pending'
            `
        )
        .bind(salespersonId)
        .first(),
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
      this.db
        .prepare(
          `
                SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
            `
        )
        .bind(salespersonId)
        .first(),
      // 已完成订单
      this.db
        .prepare(
          `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND status = 'delivered'
            `
        )
        .bind(salespersonId)
        .first(),
      // 本月订单
      this.db
        .prepare(
          `
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
            `
        )
        .bind(salespersonId, monthStart)
        .first(),
      // 近30天趋势
      this.db
        .prepare(
          `
                SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count
                FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
                GROUP BY DATE(created_at / 1000, 'unixepoch', '+8 hours')
                ORDER BY date ASC
            `
        )
        .bind(salespersonId, monthStart)
        .all(),
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
    const [todayResult, weekResult, monthResult, statusDistribution, recentTrend] =
      await Promise.all([
        this.db
          .prepare(
            `
                SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
            `
          )
          .bind(todayStart)
          .first(),
        this.db
          .prepare(
            `
                SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
            `
          )
          .bind(weekStart)
          .first(),
        this.db
          .prepare(
            `
                SELECT COUNT(*) as count FROM orders WHERE created_at >= ?
            `
          )
          .bind(monthStart)
          .first(),
        this.db
          .prepare(
            `
                SELECT status, COUNT(*) as count FROM orders GROUP BY status
            `
          )
          .all(),
        this.db
          .prepare(
            `
                SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count
                FROM orders 
                WHERE created_at >= ?
                GROUP BY date ORDER BY date
            `
          )
          .bind(monthStart)
          .all(),
      ]);
    return {
      today: todayResult.count,
      week: weekResult.count,
      month: monthResult.count,
      statusDistribution: statusDistribution.results.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {}),
      recentTrend: recentTrend.results,
    };
  }

  /**
   * 获取今日每小时订单趋势
   * @param {number} todayStart
   */
  async getTodayHourlyTrend(todayStart) {
    const result = await this.db
      .prepare(
        `
            SELECT STRFTIME('%H', created_at / 1000, 'unixepoch', '+8 hours') as hour, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= ?
            GROUP BY hour
            ORDER BY hour ASC
        `
      )
      .bind(todayStart)
      .all();
    return result.results;
  }

  /**
   * 获取过去7天订单趋势
   * @param {number} startTimestamp
   */
  async getLast7DaysOrderTrend(startTimestamp) {
    const result = await this.db
      .prepare(
        `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= ?
            GROUP BY date
            ORDER BY date ASC
        `
      )
      .bind(startTimestamp)
      .all();
    return result.results;
  }

  /**
   * 获取过去7天待处理订单趋势 (实际是新创建的订单中处于Pending状态的，或者所有新创建的Pending，这里按创建时间统计Pending订单)
   * 另一种解读是：每天处于Pending状态的快照（无法回溯）。
   * 采用方案：统计每天创建的且当前仍是 Pending 的订单 (或者创建时是Pending -> 也就是所有创建的订单).
   * 修正：为了展示"待处理负载"，展示每天新产生的"待处理"订单。
   */
  async getLast7DaysPendingTrend(startTimestamp) {
    const result = await this.db
      .prepare(
        `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= ? AND status = 'pending'
            GROUP BY date
            ORDER BY date ASC
        `
      )
      .bind(startTimestamp)
      .all();
    return result.results;
  }

  /**
   * 获取过去7天分享链接创建趋势
   * (虽然是 FolderRepository 的职责，但为了 Dashboard 便捷，暂时放在这里)
   * @param {number} startTimestamp
   */
  async getLast7DaysShareTrend(startTimestamp) {
    const result = await this.db
      .prepare(
        `
            SELECT DATE(created_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count 
            FROM folders 
            WHERE is_public = 1 AND created_at >= ?
            GROUP BY date
            ORDER BY date ASC
        `
      )
      .bind(startTimestamp)
      .all();
    return result.results;
  }
}
