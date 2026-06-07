/**
 * 订单仓库 (Order Repository) - Facade
 * =====================================
 *
 * 该类作为订单数据操作的统一入口，委托给子模块处理具体逻辑。
 * 遵循 Repository Pattern + Facade Pattern。
 *
 * @module repositories/OrderRepository
 */

import { OrderTimelineRepository } from './OrderTimelineRepository.js';
import * as queries from './order/queries.js';
import * as mutations from './order/mutations.js';

export class OrderRepository {
  /**
   * 构造函数
   * @param {D1Database} db - Cloudflare D1 数据库实例 (env.DB)
   * @param {Object} [deps={}] - 依赖注入
   * @param {Function} [deps.InventoryServiceFactory] - 工厂函数，接收 db 返回 InventoryService 实例
   */
  constructor(db, deps = {}) {
    this.db = db;
    this.timelineRepo = new OrderTimelineRepository(db);
    this._InventoryServiceFactory = deps.InventoryServiceFactory || null;
    // 懒加载 inventoryService，仅在需要时通过工厂函数创建
    this._inventoryService = null;
  }

  /**
   * 获取 InventoryService 实例（懒加载）
   * @returns {Object|null}
   */
  get inventoryService() {
    if (!this._inventoryService && this._InventoryServiceFactory) {
      this._inventoryService = this._InventoryServiceFactory(this.db);
    }
    return this._inventoryService;
  }

  // ========================================
  // 查询方法 (READ Operations)
  // ========================================

  /** @see queries.findById */
  async findById(id) {
    return queries.findById(this.db, id);
  }

  /**
   * 根据 ID 查询订单编号
   * @param {string} id 订单 ID
   * @returns {Promise<{order_no: string}|null>}
   */
  async findOrderNoById(id) {
    const result = await this.db
      .prepare('SELECT order_no FROM orders WHERE id = ?')
      .bind(id)
      .first();
    return result || null;
  }

  /**
   * 批量查询订单核心字段
   * @param {string[]} ids 订单 ID 列表
   * @returns {Promise<Array>}
   */
  async findByIds(ids) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(
      `SELECT id, order_no, salesperson_id, status FROM orders WHERE id IN (${placeholders})`
    );
    const result = await stmt.bind(...ids).all();
    return result.results || [];
  }

  /**
   * 获取订单关联的文件 ID 列表
   * @param {string} orderId 订单 ID
   * @returns {Promise<string[]>}
   */
  async getFileIds(orderId) {
    const result = await this.db
      .prepare('SELECT file_id FROM order_files WHERE order_id = ? ORDER BY sort_order')
      .bind(orderId)
      .all();
    return (result.results || []).map((row) => row.file_id);
  }

  /** @see queries.findByIdAndSalesperson */
  async findByIdAndSalesperson(id, salespersonId) {
    return queries.findByIdAndSalesperson(this.db, id, salespersonId);
  }

  /** @see queries.listBySalesperson */
  async listBySalesperson(salespersonId, options) {
    return queries.listBySalesperson(this.db, salespersonId, options);
  }

  /** @see queries.findStalePending */
  async findStalePending(thresholdTimestamp) {
    return queries.findStalePending(this.db, thresholdTimestamp);
  }

  /** @see queries.findApproachingDeadline */
  async findApproachingDeadline(startDate, endDate) {
    return queries.findApproachingDeadline(this.db, startDate, endDate);
  }

  /** @see queries.listForAdmin */
  async listForAdmin(options) {
    return queries.listForAdmin(this.db, options);
  }

  /**
   * 管理员导出订单数据
   * @param {{ status?: string, ids?: string[] }} options
   * @returns {Promise<Array>}
   */
  async exportForAdmin(options = {}) {
    const conditions = ['1=1'];
    const params = [];

    if (options.status) {
      conditions.push('o.status = ?');
      params.push(options.status);
    }

    if (options.ids && options.ids.length > 0) {
      const placeholders = options.ids.map(() => '?').join(',');
      conditions.push(`o.id IN (${placeholders})`);
      params.push(...options.ids);
    }

    const whereClause = conditions.join(' AND ');
    const sql = `
      SELECT o.id, o.order_no, o.status, o.created_at, o.updated_at,
             s.name as salesperson_name
      FROM orders o
      LEFT JOIN salespersons s ON s.id = o.salesperson_id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
    `;
    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all();
    return result.results || [];
  }

  /** @see queries.getFiles */
  async getFiles(orderId) {
    return queries.getFiles(this.db, orderId);
  }

  // ========================================
  // 变更方法 (WRITE Operations)
  // ========================================

  /** @see mutations.create */
  async create(data) {
    return mutations.create(this.db, this.timelineRepo, data);
  }

  /** @see mutations.updateData */
  async updateData(id, newData, actorType, productId, variantId) {
    return mutations.updateData(this.db, id, newData, actorType, productId, variantId);
  }

  /** @see mutations.updateComposite */
  async updateComposite(payload) {
    return mutations.updateComposite(this.db, {
      ...payload,
      inventoryService: payload?.inventoryService || this.inventoryService,
    });
  }

  /** @see mutations.updateStatus */
  async updateStatus(id, newStatus, actorType, options) {
    return mutations.updateStatus(this.db, id, newStatus, actorType, {
      ...(options || {}),
      inventoryService: options?.inventoryService || this.inventoryService,
    });
  }

  /** @see mutations.updateFiles */
  async updateFiles(orderId, fileIds) {
    return mutations.updateFiles(this.db, orderId, fileIds);
  }

  /** @see mutations.batchUpdateStatus */
  async batchUpdateStatus(ids, newStatus, timeline, options) {
    return mutations.batchUpdateStatus(this.db, this.timelineRepo, ids, newStatus, timeline, {
      ...(options || {}),
      inventoryService: options?.inventoryService || this.inventoryService,
    });
  }

  /** @see mutations.markAsRead */
  async markAsRead(id, actorType) {
    return mutations.markAsRead(this.db, id, actorType);
  }

  /** @see mutations.setUnread */
  async setUnread(id, actorType) {
    return mutations.setUnread(this.db, id, actorType);
  }

  /** @see mutations.archive */
  async archive(id, archivedBy = null) {
    return mutations.archive(this.db, id, archivedBy);
  }

  /** @see mutations.restore */
  async restore(id) {
    return mutations.restore(this.db, id);
  }

  /**
   * 标记订单为已交付
   * @param {string} id 订单 ID
   * @param {{ timestamp: number, deliveredBy?: string, note?: string }} options
   */
  async markDelivered(id, { timestamp, deliveredBy = null, note = '' } = {}) {
    const sql = `
      UPDATE orders
      SET delivery_status = 'delivered',
          delivered_at = ?,
          delivered_by = ?,
          delivery_note = ?,
          updated_at = ?
      WHERE id = ?
    `;
    const stmt = this.db.prepare(sql).bind(timestamp, deliveredBy, note, timestamp, id);
    await stmt.run();
    return { params: [timestamp, deliveredBy, note, timestamp, id] };
  }

  /**
   * 查询订单及其发货聚合信息（用于交付确认校验）
   * @param {string} orderId
   * @returns {Promise<Object|null>}
   */
  async findWithDeliveryInfo(orderId) {
    const row = await this.db
      .prepare(
        `SELECT
            o.id,
            o.order_no,
            o.status,
            o.fulfillment_status,
            o.delivery_status,
            o.delivered_at,
            o.delivered_by,
            o.delivery_note,
            COALESCE(SUM(ol.ordered_qty), 0) AS ordered_qty,
            COALESCE(SUM(ol.shipped_qty), 0) AS shipped_qty,
            COALESCE(SUM(ol.cancelled_qty), 0) AS cancelled_qty
         FROM orders o
         LEFT JOIN order_lines ol ON ol.order_id = o.id
         WHERE o.id = ?
         GROUP BY
            o.id,
            o.order_no,
            o.status,
            o.fulfillment_status,
            o.delivery_status,
            o.delivered_at,
            o.delivered_by,
            o.delivery_note
         LIMIT 1`
      )
      .bind(orderId)
      .first();
    return row || null;
  }

  /** @see mutations.deleteWithRelations */
  async deleteOrderCascading(id) {
    return mutations.deleteWithRelations(this.db, id);
  }
}
