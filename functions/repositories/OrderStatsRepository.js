/**
 * 订单统计仓库 (Order Stats Repository)
 * ===================================
 *
 * 负责订单相关的统计查询，将统计逻辑从主 OrderRepository 中分离。
 */

export class OrderStatsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Parse JSON string safely
   * @private
   */
  _parseJson(jsonStr) {
    try {
      return jsonStr ? JSON.parse(jsonStr) : {};
    } catch (e) {
      console.warn('JSON parse failed:', e);
      return {};
    }
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
      const data = this._parseJson(order.current_data);
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
                SELECT DATE(created_at / 1000, 'unixepoch', 'localtime') as date, COUNT(*) as count
                FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
                GROUP BY DATE(created_at / 1000, 'unixepoch', 'localtime')
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
                SELECT DATE(created_at / 1000, 'unixepoch') as date, COUNT(*) as count
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
}
