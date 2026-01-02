/**
 * 订单仓库 (Order Repository)
 * =========================
 *
 * 该类封装了所有与订单 (orders) 表相关的数据库操作，遵循 Repository Pattern。
 * 目的是将数据访问逻辑与业务逻辑分离，提高代码的可维护性和可测试性。
 *
 * 使用方法:
 *   const orderRepo = new OrderRepository(env.DB);
 *   const orders = await orderRepo.listBySalesperson('sp-id', { page: 1, limit: 20 });
 *
 * @module repositories/OrderRepository
 */

import { generateId, now } from '../api/utils/id.js';
import { OrderTimelineRepository } from './OrderTimelineRepository.js';

export class OrderRepository {
  /**
   * 构造函数
   * @param {D1Database} db - Cloudflare D1 数据库实例 (env.DB)
   */
  constructor(db) {
    this.db = db;
    this.timelineRepo = new OrderTimelineRepository(db);
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

  // ========================================
  // 查询方法 (READ Operations)
  // ========================================

  /**
   * 根据 ID 获取订单基本信息
   * @param {string} id - 订单 ID
   * @returns {Promise<Object|null>} 订单对象或 null
   */
  async findById(id) {
    const order = await this.db
      .prepare(
        `
            SELECT o.*, f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ?
        `
      )
      .bind(id)
      .first();

    if (!order) return null;
    return this._mapOrderDetail(order);
  }

  /**
   * 根据 ID 和销售员 ID 获取订单（用于销售端权限校验）
   * @param {string} id - 订单 ID
   * @param {string} salespersonId - 销售员 ID
   * @returns {Promise<Object|null>} 订单对象或 null
   */
  async findByIdAndSalesperson(id, salespersonId) {
    const order = await this.db
      .prepare(
        `
            SELECT o.*, f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ? AND o.salesperson_id = ?
        `
      )
      .bind(id, salespersonId)
      .first();

    if (!order) return null;
    return this._mapOrderDetail(order);
  }

  /**
   * Mark order as read for a specific actor type
   * @param {string} id
   * @param {'admin'|'sales'} actorType
   */
  async markAsRead(id, actorType) {
    const field = actorType === 'admin' ? 'unread_by_admin' : 'unread_by_sales';
    await this.db.prepare(`UPDATE orders SET ${field} = 0 WHERE id = ?`).bind(id).run();
  }

  /**
   * Set unread flag for the OTHER party based on who performed the action
   * @param {string} id
   * @param {'admin'|'sales'} actorType - The actor performing the action
   */
  async setUnread(id, actorType) {
    const targetField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';
    const timestamp = now();
    // Also update updated_at
    await this.db
      .prepare(
        `
            UPDATE orders SET ${targetField} = 1, updated_at = ? WHERE id = ?
        `
      )
      .bind(timestamp, id)
      .run();
  }

  // ... (other methods)

  // REFACTORED LIST METHODS TO MAP UNREAD STATUS

  async listBySalesperson(salespersonId, { status, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    let where = 'WHERE salesperson_id = ?';
    const params = [salespersonId];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const countResult = await this.db
      .prepare(
        `
            SELECT COUNT(*) as total FROM orders ${where}
        `
      )
      .bind(...params)
      .first();

    // SOTA: 多级优先排序 - 未读优先 > 状态优先级 > 时间倒序
    const { results } = await this.db
      .prepare(
        `
            SELECT 
                o.id, o.order_no, o.current_data, o.status, 
                o.unread_by_sales as is_unread,
                o.main_image_id, o.created_at, o.updated_at,
                f.storage_key as main_image_key,
                CASE o.status
                    WHEN 'pending' THEN 1
                    WHEN 'production' THEN 2
                    WHEN 'shipping' THEN 3
                    WHEN 'confirmed' THEN 4
                    WHEN 'arrived' THEN 5
                    WHEN 'delivered' THEN 6
                    WHEN 'rejected' THEN 7
                    WHEN 'void' THEN 99
                    ELSE 50
                END as status_priority
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            ${where}
            ORDER BY 
                o.unread_by_sales DESC,
                status_priority ASC,
                o.created_at DESC
            LIMIT ? OFFSET ?
        `
      )
      .bind(...params, limit, offset)
      .all();

    return {
      items: results.map(this._mapOrderListItem.bind(this)),
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    };
  }

  async listForAdmin({
    salespersonId,
    customerId,
    status,
    search,
    startTime,
    endTime,
    page = 1,
    limit = 20,
  } = {}) {
    // ... (params setup same as before)
    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    const bindParams = [];

    if (salespersonId) {
      whereClause += ' AND o.salesperson_id = ?';
      bindParams.push(salespersonId);
    }
    if (customerId) {
      whereClause += ' AND o.customer_id = ?';
      bindParams.push(customerId);
    }
    if (status) {
      whereClause += ' AND o.status = ?';
      bindParams.push(status);
    }
    if (startTime > 0) {
      whereClause += ' AND o.created_at >= ?';
      bindParams.push(startTime);
    }
    if (endTime > 0) {
      whereClause += ' AND o.created_at <= ?';
      bindParams.push(endTime);
    }
    if (search) {
      whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
      const searchPattern = `%${search}%`;
      bindParams.push(searchPattern, searchPattern);
    }

    const countResult = await this.db
      .prepare(
        `
            SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}
        `
      )
      .bind(...bindParams)
      .first();

    // SOTA: 多级优先排序 - 未读优先 > 状态优先级 > 时间倒序
    const { results } = await this.db
      .prepare(
        `
            SELECT 
                o.id, o.order_no, o.salesperson_id, o.current_data, o.status, 
                o.unread_by_admin as is_unread,
                o.main_image_id, o.created_at, o.updated_at,
                s.name as salesperson_name, s.store as salesperson_store,
                f.storage_key as main_image_key,
                CASE o.status
                    WHEN 'pending' THEN 1
                    WHEN 'production' THEN 2
                    WHEN 'shipping' THEN 3
                    WHEN 'confirmed' THEN 4
                    WHEN 'arrived' THEN 5
                    WHEN 'delivered' THEN 6
                    WHEN 'rejected' THEN 7
                    WHEN 'void' THEN 99
                    ELSE 50
                END as status_priority
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE ${whereClause}
            ORDER BY 
                o.unread_by_admin DESC,
                status_priority ASC,
                o.created_at DESC
            LIMIT ? OFFSET ?
        `
      )
      .bind(...bindParams, limit, offset)
      .all();

    return {
      items: results.map((order) => ({
        ...this._mapOrderListItem(order),
        salespersonName: order.salesperson_name,
        store: order.salesperson_store,
      })),
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    };
  }

  // UPDATE METHODS (Updated signature to accept actorType)

  async create({ id, orderNo, salespersonId, data, mainImageId, fileIds = [], timeline }) {
    const timestamp = now();
    const orderData = JSON.stringify(data);
    const batchStatements = [];

    // 1. 插入订单 (New orders by Sales -> Admin unread=1, Sales unread=0)
    batchStatements.push(
      this.db
        .prepare(
          `
            INSERT INTO orders (id, order_no, salesperson_id, original_data, current_data, status, main_image_id, unread_by_admin, unread_by_sales, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, 1, 0, ?, ?)
        `
        )
        .bind(id, orderNo, salespersonId, orderData, orderData, mainImageId, timestamp, timestamp)
    );

    // ... (rest same, file handling)
    // 2. 关联文件
    fileIds.forEach((fileId, index) => {
      batchStatements.push(
        this.db
          .prepare(
            `
                INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                VALUES (?, ?, ?, 'product', ?, ?)
            `
          )
          .bind(generateId(), id, fileId, index, timestamp)
      );
    });

    // 3. 记录时间轴
    if (timeline) {
      const stmt = this.timelineRepo.createInsertStatement(id, timeline);
      if (stmt) batchStatements.push(stmt);
    }

    await this.db.batch(batchStatements);
    return { id, orderNo };
  }

  /**
   * Update Data
   * @param {string} id
   * @param {Object} newData
   * @param {'admin'|'sales'} actorType - Who is updating
   */
  async updateData(id, newData, actorType) {
    const timestamp = now();
    // Determine who gets the red dot (the OTHER person)
    const updateField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';

    await this.db
      .prepare(
        `
            UPDATE orders 
            SET current_data = ?, ${updateField} = 1, updated_at = ? 
            WHERE id = ?
        `
      )
      .bind(JSON.stringify(newData), timestamp, id)
      .run();
  }

  async updateStatus(id, newStatus, actorType) {
    const timestamp = now();
    const updateField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';

    await this.db
      .prepare(
        `
            UPDATE orders 
            SET status = ?, ${updateField} = 1, updated_at = ? 
            WHERE id = ?
        `
      )
      .bind(newStatus, timestamp, id)
      .run();
  }

  /**
   * 获取订单关联的文件列表
   * @param {string} orderId - 订单 ID
   * @returns {Promise<Array>} 文件列表
   */
  async getFiles(orderId) {
    const result = await this.db
      .prepare(
        `
            SELECT f.id, f.name, f.original_name, f.mime_type, f.size, f.storage_key, f.created_at
            FROM order_files of
            JOIN files f ON of.file_id = f.id
            WHERE of.order_id = ?
            ORDER BY of.sort_order ASC, f.created_at ASC
        `
      )
      .bind(orderId)
      .all();

    return result.results.map((f) => ({
      id: f.id,
      filename: f.original_name || f.name,
      mimeType: f.mime_type,
      size: f.size,
      url: `/file/${f.storage_key}`,
      createdAt: f.created_at,
    }));
  }

  /**
   * 更新订单关联的文件列表
   * @param {string} orderId - 订单 ID
   * @param {Array<string>} fileIds - 新的文件 ID 列表
   */
  async updateFiles(orderId, fileIds) {
    // 删除原有关联
    await this.db.prepare(`DELETE FROM order_files WHERE order_id = ?`).bind(orderId).run();

    // 批量插入新关联
    if (fileIds && fileIds.length > 0) {
      const timestamp = now();
      const statements = fileIds.map((fileId, index) =>
        this.db
          .prepare(
            `
                    INSERT INTO order_files (id, order_id, file_id, section, sort_order, added_at) 
                    VALUES (?, ?, ?, 'product', ?, ?)
                `
          )
          .bind(generateId(), orderId, fileId, index, timestamp)
      );
      await this.db.batch(statements);
    }
  }

  /**
   * 清除订单的新反馈标记（销售端已读）
   * @deprecated 请使用 markAsRead(id, 'sales')
   * @param {string} orderId
   * @param {string} salespersonId - 用于验证权限（可选）
   */
  async clearNewFeedback(orderId, _salespersonId) {
    // Legacy method - just mark as read for sales
    await this.markAsRead(orderId, 'sales');
  }

  // Batch update (Admin only usually)
  async batchUpdateStatus(ids, newStatus, timeline) {
    const timestamp = now();
    const batchStatements = [];
    // Admin updates -> Sales unread
    for (const id of ids) {
      batchStatements.push(
        this.db
          .prepare(
            `
                UPDATE orders SET status = ?, unread_by_sales = 1, updated_at = ? WHERE id = ?
            `
          )
          .bind(newStatus, timestamp, id)
      );

      if (timeline) {
        const stmt = this.timelineRepo.createInsertStatement(id, { ...timeline, orderId: id });
        if (stmt) batchStatements.push(stmt);
      }
    }
    await this.db.batch(batchStatements);
  }

  // ... (rest)

  // Deprecated methods adaptation
  // setNewFeedback -> use setUnread(id, actorType) instead
  async setNewFeedback(_id) {
    // Legacy fallback, assume it notifies everyone? Or deprecate.
    // Let's assume Admin is system default for legacy calls?
    // Better to fix call sites.
    console.warn(
      'setNewFeedback is deprecated. Use setUnread(id, actorType) + markAsRead(id, actorType)'
    );
  }

  _mapOrderListItem(order) {
    const currentData = this._parseJson(order.current_data);
    return {
      id: order.id,
      orderNo: order.order_no,
      productName: currentData.name || '',
      status: order.status,
      hasNewFeedback: !!order.is_unread, // Map mapped SQL column to legacy prop name for frontend
      mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  _mapOrderDetail(order) {
    // Retrieve original props
    const originalData = this._parseJson(order.original_data);
    const currentData = this._parseJson(order.current_data);

    /* 
           Note: Detail view doesn't usually show red dot (it CLEARS it). 
           But if we need to know:
           Admin API should pass a flag to indicate if it *was* unread?
           For now, map legacy hasNewFeedback to unread_by_admin (if admin context) or unread_by_sales?
           Actually, findById doesn't know context.
           But findById is usually followed by markAsRead in the controller.
           So mapped value doesn't matter much for Detail except for UI state.
        */
    return {
      id: order.id,
      orderNo: order.order_no,
      salespersonId: order.salesperson_id,
      status: order.status,
      // hasNewFeedback: !!order.has_new_feedback, // This is legacy column.
      // We should ideally expose specific flags or let Controller decide.
      // Let's expose both for now.
      unreadByAdmin: !!order.unread_by_admin,
      unreadBySales: !!order.unread_by_sales,

      originalData,
      currentData,
      mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
      mainImageId: order.main_image_id,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }
}
