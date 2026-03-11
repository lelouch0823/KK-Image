/**
 * 通知仓库 (Notification Repository)
 * ===================================
 *
 * 该类封装了所有与通知 (notifications) 表相关的数据库操作，遵循 Repository Pattern。
 * 支持管理端和销售端双向通知。
 *
 * 使用方法:
 *   const notificationRepo = new NotificationRepository(env.DB);
 *   await notificationRepo.create({ type: 'order', title: '...', receiver: 'admin' });
 *
 * @module repositories/NotificationRepository
 */

import { generateId, now } from '../api/utils/id.js';
import { parseJsonObject } from '../api/utils/json.js';

function isMissingColumnError(error, columns = []) {
    const message = String(error?.message || error || '').toLowerCase();
    if (!message.includes('no such column')) return false;
    if (!columns || columns.length === 0) return true;
    return columns.some((column) => message.includes(String(column).toLowerCase()));
}

function parseMetadata(metadata) {
    return parseJsonObject(metadata, null);
}

export class NotificationRepository {
    /**
     * 构造函数
     * @param {D1Database} db - Cloudflare D1 数据库实例 (env.DB)
     */
    constructor(db) {
        this.db = db;
    }

    // ========================================
    // 创建通知 (CREATE)
    // ========================================

    /**
     * 创建通知
     * @param {Object} params - 通知参数
     * @param {string} params.type - 通知类型 (system, order, deadline)
     * @param {string} params.title - 标题 (可以是 i18n key 的 JSON)
     * @param {string} [params.content] - 内容
     * @param {string} [params.link] - 跳转链接
     * @param {'admin'|'sales'} params.receiver - 接收方
     * @param {string} [params.salespersonId] - 销售员 ID (receiver='sales' 时必填)
     * @param {string} [params.orderId] - 关联订单 ID
     * @param {Object} [params.metadata] - 扩展数据
     * @returns {Promise<{id: string}>}
     */
    async create({ type, title, content = '', link = '', receiver, salespersonId = null, orderId = null, metadata = null }) {
        const id = generateId();
        const timestamp = now();
        const metadataJson = metadata ? JSON.stringify(metadata) : null;

        try {
            await this.db
                .prepare(
                    `
        INSERT INTO notifications 
          (id, type, title, content, link, is_read, receiver, salesperson_id, order_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `
                )
                .bind(id, type, title, content, link, receiver, salespersonId, orderId, metadataJson, timestamp)
                .run();
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id', 'order_id'])) {
                throw error;
            }

            // 兼容旧表结构（无 receiver/salesperson_id/order_id）
            await this.db
                .prepare(
                    `
        INSERT INTO notifications
          (id, type, title, content, link, is_read, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        `
                )
                .bind(id, type, title, content, link, metadataJson, timestamp)
                .run();
        }

        return { id };
    }

    /**
     * 批量创建通知（用于批量操作）
     * @param {Array<Object>} notifications - 通知数组
     * @returns {Promise<void>}
     */
    async createBatch(notifications) {
        if (!notifications || notifications.length === 0) return;

        const timestamp = now();
        const records = notifications.map((n) => ({
            id: generateId(),
            type: n.type || 'order',
            title: n.title,
            content: n.content || '',
            link: n.link || '',
            receiver: n.receiver,
            salespersonId: n.salespersonId || null,
            orderId: n.orderId || null,
            metadataJson: n.metadata ? JSON.stringify(n.metadata) : null,
        }));

        try {
            const statements = records.map((n) =>
                this.db
                    .prepare(
                        `
          INSERT INTO notifications 
            (id, type, title, content, link, is_read, receiver, salesperson_id, order_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
          `
                    )
                    .bind(
                        n.id,
                        n.type,
                        n.title,
                        n.content,
                        n.link,
                        n.receiver,
                        n.salespersonId,
                        n.orderId,
                        n.metadataJson,
                        timestamp
                    )
            );

            await this.db.batch(statements);
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id', 'order_id'])) {
                throw error;
            }

            // 兼容旧表结构（无 receiver/salesperson_id/order_id）
            const legacyStatements = records.map((n) =>
                this.db
                    .prepare(
                        `
          INSERT INTO notifications
            (id, type, title, content, link, is_read, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?)
          `
                    )
                    .bind(n.id, n.type, n.title, n.content, n.link, n.metadataJson, timestamp)
            );
            await this.db.batch(legacyStatements);
        }
    }

    // ========================================
    // 查询通知 (READ)
    // ========================================

    /**
     * 获取管理端通知列表
     * @param {Object} options - 查询选项
     * @param {boolean} [options.unreadOnly=false] - 只获取未读
     * @param {number} [options.limit=20] - 限制数量
     * @returns {Promise<{list: Array, unreadCount: number}>}
     */
    async listForAdmin({ unreadOnly = false, limit = 20 } = {}) {
        try {
            let sql = `SELECT * FROM notifications WHERE receiver = 'admin'`;
            const params = [];

            if (unreadOnly) {
                sql += ` AND is_read = 0`;
            }

            sql += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
            params.push(limit);

            const { results } = await this.db.prepare(sql).bind(...params).all();

            // 统计未读数量
            const { count: unreadCount } = await this.db
                .prepare(`SELECT COUNT(*) as count FROM notifications WHERE receiver = 'admin' AND is_read = 0`)
                .first();

            return {
                list: results.map(this._mapNotification),
                unreadCount,
            };
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                throw error;
            }

            // 兼容旧表结构：历史库没有 receiver 字段时，管理端退化读取全部通知
            let legacySql = `SELECT * FROM notifications`;
            const params = [];
            if (unreadOnly) {
                legacySql += ` WHERE is_read = 0`;
            }
            legacySql += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
            params.push(limit);

            const { results } = await this.db.prepare(legacySql).bind(...params).all();
            const { count: unreadCount } = await this.db
                .prepare(`SELECT COUNT(*) as count FROM notifications WHERE is_read = 0`)
                .first();

            return {
                list: results.map(this._mapNotification),
                unreadCount,
            };
        }
    }

    /**
     * 获取销售端通知列表
     * @param {string} salespersonId - 销售员 ID
     * @param {Object} options - 查询选项
     * @param {boolean} [options.unreadOnly=false] - 只获取未读
     * @param {number} [options.limit=20] - 限制数量
     * @returns {Promise<{list: Array, unreadCount: number}>}
     */
    async listForSalesperson(salespersonId, { unreadOnly = false, limit = 20 } = {}) {
        try {
            let sql = `SELECT * FROM notifications WHERE receiver = 'sales' AND salesperson_id = ?`;
            const params = [salespersonId];

            if (unreadOnly) {
                sql += ` AND is_read = 0`;
            }

            sql += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
            params.push(limit);

            const { results } = await this.db.prepare(sql).bind(...params).all();

            // 统计未读数量
            const { count: unreadCount } = await this.db
                .prepare(
                    `SELECT COUNT(*) as count FROM notifications WHERE receiver = 'sales' AND salesperson_id = ? AND is_read = 0`
                )
                .bind(salespersonId)
                .first();

            return {
                list: results.map(this._mapNotification),
                unreadCount,
            };
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id'])) {
                throw error;
            }

            // 兼容旧表结构：历史库无销售端归属信息，返回空列表而非抛异常
            return {
                list: [],
                unreadCount: 0,
            };
        }
    }

    // ========================================
    // 标记已读 (UPDATE)
    // ========================================

    /**
     * 标记管理端单个通知为已读
     * @param {string} id - 通知 ID
     * @returns {Promise<void>}
     */
    async markAsReadForAdmin(id) {
        try {
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND receiver = 'admin'`).bind(id).run();
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                throw error;
            }
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).bind(id).run();
        }
    }

    /**
     * 标记销售端单个通知为已读
     * @param {string} id - 通知 ID
     * @param {string} salespersonId - 销售员 ID
     * @returns {Promise<void>}
     */
    async markAsReadForSalesperson(id, salespersonId) {
        try {
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND receiver = 'sales' AND salesperson_id = ?`).bind(id, salespersonId).run();
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id'])) {
                throw error;
            }
        }
    }

    /**
     * 标记管理端所有通知为已读
     * @returns {Promise<void>}
     */
    async markAllAsReadForAdmin() {
        try {
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE receiver = 'admin' AND is_read = 0`).run();
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                throw error;
            }
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE is_read = 0`).run();
        }
    }

    /**
     * 标记销售员所有通知为已读
     * @param {string} salespersonId - 销售员 ID
     * @returns {Promise<void>}
     */
    async markAllAsReadForSalesperson(salespersonId) {
        try {
            await this.db
                .prepare(`UPDATE notifications SET is_read = 1 WHERE receiver = 'sales' AND salesperson_id = ? AND is_read = 0`)
                .bind(salespersonId)
                .run();
        } catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id'])) {
                throw error;
            }
        }
    }

    // ========================================
    // 内部方法
    // ========================================

    /**
     * 映射通知数据
     * @private
     */
    _mapNotification(n) {
        return {
            id: n.id,
            type: n.type,
            title: n.title,
            content: n.content,
            link: n.link,
            is_read: n.is_read,
            receiver: n.receiver || 'admin',
            orderId: n.order_id,
            metadata: parseMetadata(n.metadata),
            created_at: n.created_at,
        };
    }
}
