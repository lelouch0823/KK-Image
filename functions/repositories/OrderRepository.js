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

    // ========================================
    // 查询方法 (READ Operations)
    // ========================================

    /**
     * 根据 ID 获取订单基本信息
     * @param {string} id - 订单 ID
     * @returns {Promise<Object|null>} 订单对象或 null
     */
    async findById(id) {
        const order = await this.db.prepare(`
            SELECT o.*, f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ?
        `).bind(id).first();

        if (!order) return null;
        return this._mapOrderDetail(order);
    }

    /**
     * 根据 ID 获取订单（验证所属销售）
     * 用于销售端接口，确保只能访问自己的订单
     * @param {string} id - 订单 ID
     * @param {string} salespersonId - 销售 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdAndSalesperson(id, salespersonId) {
        const order = await this.db.prepare(`
            SELECT o.*, f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ? AND o.salesperson_id = ?
        `).bind(id, salespersonId).first();

        if (!order) return null;
        return this._mapOrderDetail(order);
    }

    /**
     * 按销售员分页查询订单列表
     * @param {string} salespersonId - 销售 ID
     * @param {Object} options - 查询选项
     * @param {string} [options.status] - 状态筛选
     * @param {number} [options.page=1] - 页码
     * @param {number} [options.limit=20] - 每页数量
     * @returns {Promise<{items: Array, total: number, page: number, limit: number, totalPages: number}>}
     */
    async listBySalesperson(salespersonId, { status, page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;

        let where = 'WHERE salesperson_id = ?';
        const params = [salespersonId];

        if (status) {
            where += ' AND status = ?';
            params.push(status);
        }

        // 获取总数
        const countResult = await this.db.prepare(`
            SELECT COUNT(*) as total FROM orders ${where}
        `).bind(...params).first();

        // 获取列表
        const { results } = await this.db.prepare(`
            SELECT 
                o.id, o.order_no, o.current_data, o.status, o.has_new_feedback,
                o.main_image_id, o.created_at, o.updated_at,
                f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            ${where}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...params, limit, offset).all();

        return {
            items: results.map(this._mapOrderListItem.bind(this)),
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit)
        };
    }

    /**
     * 管理端分页查询订单列表（支持多条件筛选）
     * @param {Object} options - 查询选项
     * @param {string} [options.salespersonId] - 销售筛选
     * @param {string} [options.status] - 状态筛选
     * @param {string} [options.search] - 搜索关键词
     * @param {number} [options.startTime] - 开始时间戳
     * @param {number} [options.endTime] - 结束时间戳
     * @param {number} [options.page=1] - 页码
     * @param {number} [options.limit=20] - 每页数量
     */
    async listForAdmin({ salespersonId, customerId, status, search, startTime, endTime, page = 1, limit = 20 } = {}) {
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

        // 总数
        const countResult = await this.db.prepare(`
            SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}
        `).bind(...bindParams).first();

        // 列表
        const { results } = await this.db.prepare(`
            SELECT 
                o.id, o.order_no, o.salesperson_id, o.current_data, o.status, 
                o.has_new_feedback, o.main_image_id, o.created_at, o.updated_at,
                s.name as salesperson_name, s.store as salesperson_store,
                f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...bindParams, limit, offset).all();

        return {
            items: results.map(order => ({
                ...this._mapOrderListItem(order),
                salespersonName: order.salesperson_name,
                store: order.salesperson_store
            })),
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit)
        };
    }

    // ========================================
    // 写入方法 (WRITE Operations)
    // ========================================

    /**
     * 创建订单
     * 使用 D1 Batch 确保原子性
     * @param {Object} params - 订单参数
     * @param {string} params.id - 订单 ID
     * @param {string} params.orderNo - 订单编号
     * @param {string} params.salespersonId - 销售 ID
     * @param {Object} params.data - 订单数据
     * @param {string|null} params.mainImageId - 主图 ID
     * @param {Array<string>} [params.fileIds] - 关联文件 ID 列表
     * @param {Object} params.timeline - 时间轴记录
     */
    async create({ id, orderNo, salespersonId, data, mainImageId, fileIds = [], timeline }) {
        const timestamp = now();
        const orderData = JSON.stringify(data);
        const batchStatements = [];

        // 1. 插入订单
        batchStatements.push(this.db.prepare(`
            INSERT INTO orders (id, order_no, salesperson_id, original_data, current_data, status, main_image_id, has_new_feedback, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
        `).bind(id, orderNo, salespersonId, orderData, orderData, mainImageId, timestamp, timestamp));

        // 2. 关联文件
        fileIds.forEach((fileId, index) => {
            batchStatements.push(this.db.prepare(`
                INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                VALUES (?, ?, ?, 'product', ?, ?)
            `).bind(generateId(), id, fileId, index, timestamp));
        });

        // 3. 记录时间轴
        if (timeline) {
            const stmt = this.timelineRepo.createInsertStatement(id, timeline);
            if (stmt) batchStatements.push(stmt);
        }

        // 执行原子批量操作
        await this.db.batch(batchStatements);

        return { id, orderNo };
    }

    /**
     * 更新订单数据
     * @param {string} id - 订单 ID
     * @param {Object} newData - 新的订单数据 (完整 JSON)
     * @param {boolean} [setNewFeedback=true] - 是否设置红点
     */
    async updateData(id, newData, setNewFeedback = true) {
        const timestamp = now();
        await this.db.prepare(`
            UPDATE orders 
            SET current_data = ?, has_new_feedback = ?, updated_at = ? 
            WHERE id = ?
        `).bind(JSON.stringify(newData), setNewFeedback ? 1 : 0, timestamp, id).run();
    }

    /**
     * 更新订单状态
     * @param {string} id - 订单 ID
     * @param {string} newStatus - 新状态
     * @param {boolean} [setNewFeedback=true] - 是否设置红点
     */
    async updateStatus(id, newStatus, setNewFeedback = true) {
        const timestamp = now();
        await this.db.prepare(`
            UPDATE orders 
            SET status = ?, has_new_feedback = ?, updated_at = ? 
            WHERE id = ?
        `).bind(newStatus, setNewFeedback ? 1 : 0, timestamp, id).run();
    }

    /**
     * 批量更新订单状态
     * 使用 D1 Batch 确保原子性
     * @param {Array<string>} ids - 订单 ID 列表
     * @param {string} newStatus - 新状态
     * @param {Object} timeline - 时间轴模板 (不含 orderId)
     */
    async batchUpdateStatus(ids, newStatus, timeline) {
        const timestamp = now();
        const batchStatements = [];

        for (const id of ids) {
            // 更新订单状态
            batchStatements.push(this.db.prepare(`
                UPDATE orders SET status = ?, has_new_feedback = 1, updated_at = ? WHERE id = ?
            `).bind(newStatus, timestamp, id));

            // 记录时间轴
            if (timeline) {
                const stmt = this.timelineRepo.createInsertStatement(id, { ...timeline, orderId: id });
                if (stmt) batchStatements.push(stmt);
            }
        }

        await this.db.batch(batchStatements);
    }

    /**
     * 更新主图
     * @param {string} id - 订单 ID
     * @param {string|null} mainImageId - 主图文件 ID
     */
    async updateMainImage(id, mainImageId) {
        await this.db.prepare(`
            UPDATE orders SET main_image_id = ? WHERE id = ?
        `).bind(mainImageId, id).run();
    }

    /**
     * 清除红点标记
     * @param {string} id - 订单 ID
     * @param {string} [salespersonId] - 可选，销售 ID（用于权限验证）
     */
    async clearNewFeedback(id, salespersonId = null) {
        let sql = 'UPDATE orders SET has_new_feedback = 0 WHERE id = ?';
        const params = [id];

        if (salespersonId) {
            sql += ' AND salesperson_id = ?';
            params.push(salespersonId);
        }

        await this.db.prepare(sql).bind(...params).run();
    }

    /**
     * 设置红点标记（有新反馈）
     * @param {string} id - 订单 ID
     */
    async setNewFeedback(id) {
        const timestamp = now();
        await this.db.prepare(`
            UPDATE orders SET has_new_feedback = 1, updated_at = ? WHERE id = ?
        `).bind(timestamp, id).run();
    }

    // ========================================
    // 订单文件相关
    // ========================================

    /**
     * 获取订单关联的文件
     * @param {string} orderId - 订单 ID
     */
    async getFiles(orderId) {
        const { results } = await this.db.prepare(`
            SELECT of.section, of.sort_order, f.id, f.original_name, f.storage_key, f.mime_type, f.size
            FROM order_files of
            JOIN files f ON of.file_id = f.id
            WHERE of.order_id = ?
            ORDER BY of.section, of.sort_order
        `).bind(orderId).all();

        return results.map(f => ({
            id: f.id,
            name: f.original_name,
            url: `/file/${f.storage_key}`,
            mimeType: f.mime_type,
            size: f.size,
            section: f.section
        }));
    }

    /**
     * 更新订单文件关联
     * @param {string} orderId - 订单 ID
     * @param {Array<string>} fileIds - 新的文件 ID 列表
     */
    async updateFiles(orderId, fileIds) {
        const timestamp = now();
        const batchStatements = [];

        // 删除旧关联
        batchStatements.push(this.db.prepare('DELETE FROM order_files WHERE order_id = ?').bind(orderId));

        // 插入新关联
        fileIds.forEach((fileId, index) => {
            batchStatements.push(this.db.prepare(`
                INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                VALUES (?, ?, ?, 'product', ?, ?)
            `).bind(generateId(), orderId, fileId, index, timestamp));
        });

        await this.db.batch(batchStatements);

        // 更新主图为第一张
        if (fileIds.length > 0) {
            await this.updateMainImage(orderId, fileIds[0]);
        } else {
            await this.updateMainImage(orderId, null);
        }
    }

    // ========================================
    // 提醒/定时任务相关
    // ========================================

    /**
     * 查找滞留的待处理订单（超过指定时间）
     * 用于 Cron 提醒
     * @param {number} threshold - 时间阈值（毫秒时间戳）
     * @returns {Promise<Array>}
     */
    async findStalePending(threshold) {
        const { results } = await this.db.prepare(`
            SELECT id, order_no, created_at FROM orders 
            WHERE status = 'pending' AND created_at < ?
        `).bind(threshold).all();

        return results.map(o => ({
            id: o.id,
            orderNo: o.order_no,
            createdAt: o.created_at
        }));
    }

    /**
     * 查找即将到期的订单
     * 用于 Cron 提醒
     * @param {string} deadlineDate - 截止日期 (YYYY-MM-DD)
     * @returns {Promise<Array>}
     */
    async findApproachingDeadline(deadlineDate) {
        const { results } = await this.db.prepare(`
            SELECT id, order_no, current_data FROM orders 
            WHERE status IN ('pending', 'confirmed', 'in_progress')
            AND current_data LIKE ?
        `).bind(`%"deadline":"${deadlineDate}"%`).all();

        return results.map(o => {
            const data = this._parseJson(o.current_data);
            return {
                id: o.id,
                orderNo: o.order_no,
                deadline: data.deadline,
                name: data.name
            };
        });
    }

    // ========================================
    // 私有辅助方法
    // ========================================

    /**
     * 解析 JSON 字符串，失败时返回空对象
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
     * 映射订单列表项（简要信息）
     * @private
     */
    _mapOrderListItem(order) {
        const currentData = this._parseJson(order.current_data);
        return {
            id: order.id,
            orderNo: order.order_no,
            productName: currentData.name || '',
            status: order.status,
            hasNewFeedback: !!order.has_new_feedback,
            mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
            createdAt: order.created_at,
            updatedAt: order.updated_at
        };
    }

    /**
     * 映射订单详情（完整信息）
     * @private
     */
    _mapOrderDetail(order) {
        const originalData = this._parseJson(order.original_data);
        const currentData = this._parseJson(order.current_data);
        return {
            id: order.id,
            orderNo: order.order_no,
            salespersonId: order.salesperson_id,
            status: order.status,
            hasNewFeedback: !!order.has_new_feedback,
            originalData,
            currentData,
            mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
            mainImageId: order.main_image_id,
            createdAt: order.created_at,
            updatedAt: order.updated_at
        };
    }
}

