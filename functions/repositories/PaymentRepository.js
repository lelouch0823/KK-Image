/**
 * 付款记录仓库 (Payment Repository)
 * ====================================
 *
 * 处理订单付款记录的 CRUD 操作
 * 应收账款跟踪的核心数据层
 *
 * @module repositories/PaymentRepository
 */

import { generateId, now } from '../api/utils/id.js';

export class PaymentRepository {
  /**
   * 构造函数
   * @param {D1Database} db - Cloudflare D1 数据库实例
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 查询订单的付款记录列表
   * @param {string} orderId - 订单 ID
   * @returns {Promise<Array<Object>>}
   */
  async findByOrder(orderId) {
    const { results } = await this.db
      .prepare(
        `SELECT id, order_id, amount, method, reference_no, notes, received_at, created_by
         FROM payments
         WHERE order_id = ?
         ORDER BY received_at DESC`
      )
      .bind(orderId)
      .all();

    return results.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      amount: row.amount,
      method: row.method,
      referenceNo: row.reference_no,
      notes: row.notes,
      receivedAt: row.received_at,
      createdBy: row.created_by,
    }));
  }

  /**
   * 添加付款记录
   * @param {Object} params
   * @param {string} params.orderId - 订单 ID
   * @param {number} params.amount - 付款金额
   * @param {string} params.method - 付款方式 (cash/bank/wechat/alipay/other)
   * @param {string} [params.referenceNo] - 参考编号
   * @param {string} [params.notes] - 备注
   * @param {string} [params.createdBy] - 创建人
   * @returns {Promise<Object>} 创建的付款记录
   */
  async create({ orderId, amount, method = 'cash', referenceNo = null, notes = null, createdBy = null }) {
    const id = generateId();
    const timestamp = now();

    await this.db
      .prepare(
        `INSERT INTO payments (id, order_id, amount, method, reference_no, notes, received_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, orderId, amount, method, referenceNo, notes, timestamp, createdBy)
      .run();

    return {
      id,
      orderId,
      amount,
      method,
      referenceNo,
      notes,
      receivedAt: timestamp,
      createdBy,
    };
  }

  /**
   * 删除付款记录
   * @param {string} id - 付款记录 ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.db
      .prepare('DELETE FROM payments WHERE id = ?')
      .bind(id)
      .run();

    return result.meta?.changes > 0;
  }

  /**
   * 获取订单的已付总额
   * @param {string} orderId - 订单 ID
   * @returns {Promise<number>}
   */
  async getTotalPaid(orderId) {
    const row = await this.db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE order_id = ?')
      .bind(orderId)
      .first();

    return row?.total ?? 0;
  }

  /**
   * 获取应收账款汇总
   * 包括：总应收、已收、未收、账龄分析
   * @param {Object} [options]
   * @param {string} [options.customerId] - 按客户筛选
   * @param {string} [options.salespersonId] - 按销售员筛选
   * @returns {Promise<Object>}
   */
  async getReceivablesSummary(options = {}) {
    const { customerId, salespersonId } = options;

    // 1. 获取所有有效订单的总金额和已付金额
    let whereClause = "WHERE o.status NOT IN ('void', 'rejected')";
    const params = [];

    if (customerId) {
      whereClause += ' AND o.customer_id = ?';
      params.push(customerId);
    }
    if (salespersonId) {
      whereClause += ' AND o.salesperson_id = ?';
      params.push(salespersonId);
    }

    const summary = await this.db
      .prepare(
        `SELECT
           COUNT(*) AS order_count,
           COALESCE(SUM(o.quantity), 0) AS total_quantity,
           COALESCE(SUM(paid.total_paid), 0) AS total_paid
         FROM orders o
         LEFT JOIN (
           SELECT order_id, SUM(amount) AS total_paid
           FROM payments
           GROUP BY order_id
         ) paid ON paid.order_id = o.id
         ${whereClause}`
      )
      .bind(...params)
      .first();

    // 2. 获取账龄分析
    const aging = await this.getAgingAnalysis(options);

    const totalQuantity = summary?.total_quantity ?? 0;
    const totalPaid = summary?.total_paid ?? 0;

    return {
      orderCount: summary?.order_count ?? 0,
      totalQuantity,
      totalPaid,
      totalOutstanding: totalQuantity - totalPaid,
      aging,
    };
  }

  /**
   * 获取应收账款账龄分析
   * 将未付款的订单按创建时间分桶：0-30天、31-60天、61-90天、90天以上
   * @param {Object} [options]
   * @param {string} [options.customerId] - 按客户筛选
   * @param {string} [options.salespersonId] - 按销售员筛选
   * @returns {Promise<Object>}
   */
  async getAgingAnalysis(options = {}) {
    const { customerId, salespersonId } = options;
    const nowTimestamp = now();
    const dayMs = 24 * 60 * 60 * 1000;

    let whereClause = "WHERE o.status NOT IN ('void', 'rejected')";
    const params = [nowTimestamp - 30 * dayMs, nowTimestamp - 60 * dayMs, nowTimestamp - 90 * dayMs];

    if (customerId) {
      whereClause += ' AND o.customer_id = ?';
      params.push(customerId);
    }
    if (salespersonId) {
      whereClause += ' AND o.salesperson_id = ?';
      params.push(salespersonId);
    }

    const row = await this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN o.created_at >= ? THEN 1 ELSE 0 END) AS count_0_30,
           SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS count_31_60,
           SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS count_61_90,
           SUM(CASE WHEN o.created_at < ? THEN 1 ELSE 0 END) AS count_90_plus,
           COALESCE(SUM(CASE WHEN o.created_at >= ? THEN paid.total_paid ELSE 0 END), 0) AS paid_0_30,
           COALESCE(SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN paid.total_paid ELSE 0 END), 0) AS paid_31_60,
           COALESCE(SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN paid.total_paid ELSE 0 END), 0) AS paid_61_90,
           COALESCE(SUM(CASE WHEN o.created_at < ? THEN paid.total_paid ELSE 0 END), 0) AS paid_90_plus
         FROM orders o
         LEFT JOIN (
           SELECT order_id, SUM(amount) AS total_paid
           FROM payments
           GROUP BY order_id
         ) paid ON paid.order_id = o.id
         ${whereClause}`
      )
      .bind(
        nowTimestamp - 30 * dayMs,
        nowTimestamp - 60 * dayMs, nowTimestamp - 30 * dayMs,
        nowTimestamp - 90 * dayMs, nowTimestamp - 60 * dayMs,
        nowTimestamp - 90 * dayMs,
        nowTimestamp - 30 * dayMs,
        nowTimestamp - 60 * dayMs, nowTimestamp - 30 * dayMs,
        nowTimestamp - 90 * dayMs, nowTimestamp - 60 * dayMs,
        nowTimestamp - 90 * dayMs,
        ...params.slice(3)
      )
      .first();

    return [
      { label: '0-30', orderCount: row?.count_0_30 ?? 0, totalPaid: row?.paid_0_30 ?? 0 },
      { label: '31-60', orderCount: row?.count_31_60 ?? 0, totalPaid: row?.paid_31_60 ?? 0 },
      { label: '61-90', orderCount: row?.count_61_90 ?? 0, totalPaid: row?.paid_61_90 ?? 0 },
      { label: '90+', orderCount: row?.count_90_plus ?? 0, totalPaid: row?.paid_90_plus ?? 0 },
    ];
  }

  /**
   * 获取欠款最多的客户列表
   * @param {number} [limit=10] - 返回数量
   * @returns {Promise<Array<Object>>}
   */
  async getTopDebtors(limit = 10) {
    const { results } = await this.db
      .prepare(
        `SELECT
           c.id AS customer_id,
           c.name AS customer_name,
           c.company AS customer_company,
           COUNT(o.id) AS order_count,
           COALESCE(SUM(o.quantity), 0) AS total_quantity,
           COALESCE(SUM(paid.total_paid), 0) AS total_paid
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         LEFT JOIN (
           SELECT order_id, SUM(amount) AS total_paid
           FROM payments
           GROUP BY order_id
         ) paid ON paid.order_id = o.id
         WHERE o.status NOT IN ('void', 'rejected')
         GROUP BY c.id, c.name, c.company
         HAVING total_paid < total_quantity
         ORDER BY (total_quantity - total_paid) DESC
         LIMIT ?`
      )
      .bind(limit)
      .all();

    return results.map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerCompany: row.customer_company,
      orderCount: row.order_count,
      totalQuantity: row.total_quantity,
      totalPaid: row.total_paid,
      outstanding: row.total_quantity - row.total_paid,
    }));
  }
}
