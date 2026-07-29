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
import { executeBatchChunks } from '../lib/db/batch.js';
import { isMissingColumnError, isUniqueConstraintError } from '../lib/db/errors.js';
export class NotificationRepository {
    db;
    columnExistsCache = new Map();
    /**
     * 构造函数
     * @param db Cloudflare D1 数据库实例 (env.DB)
     */
    constructor(db) {
        this.db = db;
    }
    // ========================================
    // 创建通知 (CREATE)
    // ========================================
    /**
     * 创建通知
     * @param params 通知参数
     * @returns 创建结果
     */
    async create({ type, title, content = '', link = '', receiver, salespersonId = null, orderId = null, metadata = null }) {
        const id = generateId();
        const timestamp = now();
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        try {
            await this.db
                .prepare(`
        INSERT INTO notifications
          (id, type, title, content, link, is_read, receiver, salesperson_id, order_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `)
                .bind(id, type, title, content, link, receiver, salespersonId, orderId, metadataJson, timestamp)
                .run();
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id', 'order_id'])) {
                throw error;
            }
            // 兼容旧表结构（无 receiver/salesperson_id/order_id）
            await this.db
                .prepare(`
        INSERT INTO notifications
          (id, type, title, content, link, is_read, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        `)
                .bind(id, type, title, content, link, metadataJson, timestamp)
                .run();
        }
        return { id };
    }
    /**
     * 创建或复用来自领域事件的通知。
     * 在支持 source_* / dedupe_key 字段的 schema 上持久化去重元数据；
     * 旧 schema 则回退到普通 create，保持兼容性。
     *
     * @param params 领域事件通知参数
     * @returns 创建结果
     */
    async createFromDomainEvent({ type, title, content = '', link = '', receiver, salespersonId = null, orderId = null, metadata = null, sourceConsumer, sourceEventId, dedupeKey, }) {
        try {
            const existing = await this.findBySourceDedupe({
                sourceConsumer,
                dedupeKey,
                receiver,
                salespersonId,
            });
            if (existing) {
                return { id: existing.id, created: false };
            }
            const id = generateId();
            const timestamp = now();
            const metadataJson = metadata ? JSON.stringify(metadata) : null;
            await this.db
                .prepare(`
        INSERT INTO notifications
          (
            id,
            type,
            title,
            content,
            link,
            is_read,
            receiver,
            salesperson_id,
            order_id,
            metadata,
            source_consumer,
            source_event_id,
            dedupe_key,
            created_at
          )
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
                .bind(id, type, title, content, link, receiver, salespersonId, orderId, metadataJson, sourceConsumer, sourceEventId, dedupeKey, timestamp)
                .run();
            return { id, created: true };
        }
        catch (error) {
            if (isUniqueConstraintError(error)) {
                const existing = await this.findBySourceDedupe({
                    sourceConsumer,
                    dedupeKey,
                    receiver,
                    salespersonId,
                });
                if (existing) {
                    return { id: existing.id, created: false };
                }
            }
            if (!isMissingColumnError(error, ['source_consumer', 'source_event_id', 'dedupe_key'])) {
                throw error;
            }
            const legacyResult = await this.create({
                type,
                title,
                content,
                link,
                receiver,
                salespersonId,
                orderId,
                metadata,
            });
            return {
                id: legacyResult.id,
                created: true,
            };
        }
    }
    /**
     * 批量创建通知（用于批量操作）
     * @param notifications 通知数组
     */
    async createBatch(notifications) {
        if (!notifications || notifications.length === 0)
            return;
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
            const statements = records.map((n) => this.db
                .prepare(`
          INSERT INTO notifications
            (id, type, title, content, link, is_read, receiver, salesperson_id, order_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
          `)
                .bind(n.id, n.type, n.title, n.content, n.link, n.receiver, n.salespersonId, n.orderId, n.metadataJson, timestamp));
            await executeBatchChunks(this.db, statements);
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id', 'order_id'])) {
                throw error;
            }
            // 兼容旧表结构（无 receiver/salesperson_id/order_id）
            const legacyStatements = records.map((n) => this.db
                .prepare(`
          INSERT INTO notifications
            (id, type, title, content, link, is_read, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?)
          `)
                .bind(n.id, n.type, n.title, n.content, n.link, n.metadataJson, timestamp));
            await executeBatchChunks(this.db, legacyStatements);
        }
    }
    // ========================================
    // 查询通知 (READ)
    // ========================================
    /**
     * 获取管理端通知列表
     * @param options 查询选项
     * @returns 通知列表和未读数量
     */
    async listForAdmin({ unreadOnly = false, limit = 20 } = {}) {
        // 基础查询 - 只使用所有表版本都存在的核心列
        let sql = `SELECT id, type, title, content, is_read, metadata, link, created_at FROM notifications`;
        const params = [];
        // 尝试使用 receiver 字段过滤，如果不存在则读取全部
        try {
            const hasReceiver = await this._checkColumnExists('receiver');
            if (hasReceiver) {
                sql += ` WHERE receiver = 'admin'`;
                if (unreadOnly) {
                    sql += ` AND is_read = 0`;
                }
            }
            else {
                if (unreadOnly) {
                    sql += ` WHERE is_read = 0`;
                }
            }
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                console.warn('[NotificationRepository] listForAdmin column check failed:', error?.message);
            }
            if (unreadOnly) {
                sql += ` WHERE is_read = 0`;
            }
        }
        sql += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
        params.push(limit);
        const [{ results }, unreadCount] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this._getAdminUnreadCount(unreadOnly),
        ]);
        return {
            list: results.map(this._mapNotification),
            unreadCount,
        };
    }
    /**
     * 轮询管理端通知：返回未读数量、最新通知 ID、以及指定 lastId 之后的新通知
     * @param options 轮询选项
     * @returns 轮询结果
     */
    async pollForAdmin({ lastId = null, limit = 5 } = {}) {
        // 并行获取未读数量和最新通知 ID
        const [unreadCount, latestId] = await Promise.all([
            this._getAdminUnreadCount(true),
            this._getLatestNotificationId(),
        ]);
        // 如果提供了 lastId 且与最新相同，说明无新通知
        if (lastId && latestId && lastId === latestId) {
            return { unreadCount, latestId, newNotifications: [] };
        }
        // 获取 lastId 之后的新通知（如果提供了 lastId）
        let newNotifications = [];
        if (lastId) {
            try {
                let newSql = `SELECT id, type, title, content, is_read, metadata, link, created_at FROM notifications`;
                const conditions = [];
                const params = [];
                try {
                    const hasReceiver = await this._checkColumnExists('receiver');
                    if (hasReceiver) {
                        conditions.push(`receiver = 'admin'`);
                    }
                }
                catch (error) {
                    if (!isMissingColumnError(error, ['receiver'])) {
                        console.warn('[NotificationRepository] pollForAdmin receiver check failed:', error?.message);
                    }
                }
                conditions.push(`created_at > (SELECT created_at FROM notifications WHERE id = ?)`);
                params.push(lastId);
                if (conditions.length > 0) {
                    newSql += ` WHERE ${conditions.join(' AND ')}`;
                }
                newSql += ` ORDER BY created_at DESC LIMIT ?`;
                params.push(limit);
                const { results } = await this.db.prepare(newSql).bind(...params).all();
                newNotifications = results.map(this._mapNotification);
            }
            catch (error) {
                console.warn('[NotificationRepository] pollForAdmin query failed:', error?.message);
                const { results } = await this.db
                    .prepare(`SELECT id, type, title, content, is_read, metadata, link, created_at FROM notifications ORDER BY created_at DESC LIMIT ?`)
                    .bind(limit)
                    .all();
                newNotifications = results.map(this._mapNotification);
            }
        }
        else {
            // 首次轮询，返回最新通知
            const { results } = await this.db
                .prepare(`SELECT id, type, title, content, is_read, metadata, link, created_at FROM notifications ORDER BY created_at DESC LIMIT ?`)
                .bind(limit)
                .all();
            newNotifications = results.map(this._mapNotification);
        }
        return { unreadCount, latestId, newNotifications };
    }
    /**
     * 获取最新通知 ID
     * @private
     */
    async _getLatestNotificationId() {
        let sql = `SELECT id FROM notifications`;
        try {
            const hasReceiver = await this._checkColumnExists('receiver');
            if (hasReceiver) {
                sql += ` WHERE receiver = 'admin'`;
            }
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                console.warn('[NotificationRepository] _getLatestNotificationId check failed:', error?.message);
            }
        }
        sql += ` ORDER BY created_at DESC LIMIT 1`;
        const latestRow = await this.db.prepare(sql).first();
        return latestRow?.id || null;
    }
    /**
     * 检查表中是否存在指定列（带缓存）
     * @private
     */
    async _checkColumnExists(columnName) {
        if (this.columnExistsCache.has(columnName)) {
            return this.columnExistsCache.get(columnName);
        }
        try {
            await this.db.prepare(`SELECT ${columnName} FROM notifications LIMIT 1`).first();
            this.columnExistsCache.set(columnName, true);
            return true;
        }
        catch (error) {
            if (!isMissingColumnError(error, [columnName])) {
                console.warn('[NotificationRepository] _checkColumnExists unexpected error:', error?.message);
            }
            this.columnExistsCache.set(columnName, false);
            return false;
        }
    }
    /**
     * 获取管理员未读通知数量
     * @private
     */
    async _getAdminUnreadCount(unreadOnly) {
        if (!unreadOnly)
            return 0;
        try {
            const hasReceiver = await this._checkColumnExists('receiver');
            const sql = hasReceiver
                ? `SELECT COUNT(*) as count FROM notifications WHERE receiver = 'admin' AND is_read = 0`
                : `SELECT COUNT(*) as count FROM notifications WHERE is_read = 0`;
            const result = await this.db.prepare(sql).first();
            return result?.count || 0;
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                console.warn('[NotificationRepository] _getAdminUnreadCount failed:', error?.message);
            }
            return 0;
        }
    }
    /**
     * 获取销售端通知列表
     * @param salespersonId 销售员 ID
     * @param options 查询选项
     * @returns 通知列表和未读数量
     */
    async listForSalesperson(salespersonId, { unreadOnly = false, limit = 20 } = {}) {
        // 检查是否有销售端相关字段
        const hasReceiver = await this._checkColumnExists('receiver');
        const hasSalespersonId = await this._checkColumnExists('salesperson_id');
        // 如果缺少必要字段，返回空列表
        if (!hasReceiver || !hasSalespersonId) {
            return { list: [], unreadCount: 0 };
        }
        let sql = `SELECT id, type, title, content, is_read, metadata, link, created_at FROM notifications WHERE receiver = 'sales' AND salesperson_id = ?`;
        const params = [salespersonId];
        if (unreadOnly) {
            sql += ` AND is_read = 0`;
        }
        sql += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
        params.push(limit);
        const [{ results }, unreadCount] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this._getSalespersonUnreadCount(salespersonId, unreadOnly),
        ]);
        return {
            list: results.map(this._mapNotification),
            unreadCount,
        };
    }
    /**
     * 获取销售员未读通知数量
     * @private
     */
    async _getSalespersonUnreadCount(salespersonId, unreadOnly) {
        if (!unreadOnly)
            return 0;
        try {
            const result = await this.db
                .prepare(`SELECT COUNT(*) as count FROM notifications WHERE receiver = 'sales' AND salesperson_id = ? AND is_read = 0`)
                .bind(salespersonId)
                .first();
            return result?.count || 0;
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id'])) {
                console.warn('[NotificationRepository] _getSalespersonUnreadCount failed:', error?.message);
            }
            return 0;
        }
    }
    // ========================================
    // 标记已读 (UPDATE)
    // ========================================
    /**
     * 标记管理端单个通知为已读
     * @param id 通知 ID
     */
    async markAsReadForAdmin(id) {
        try {
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND receiver = 'admin'`).bind(id).run();
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                throw error;
            }
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).bind(id).run();
        }
    }
    /**
     * 标记销售端单个通知为已读
     * @param id 通知 ID
     * @param salespersonId 销售员 ID
     */
    async markAsReadForSalesperson(id, salespersonId) {
        try {
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND receiver = 'sales' AND salesperson_id = ?`).bind(id, salespersonId).run();
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id'])) {
                throw error;
            }
        }
    }
    /**
     * 标记管理端所有通知为已读
     */
    async markAllAsReadForAdmin() {
        try {
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE receiver = 'admin' AND is_read = 0`).run();
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver'])) {
                throw error;
            }
            await this.db.prepare(`UPDATE notifications SET is_read = 1 WHERE is_read = 0`).run();
        }
    }
    /**
     * 标记销售员所有通知为已读
     * @param salespersonId 销售员 ID
     */
    async markAllAsReadForSalesperson(salespersonId) {
        try {
            await this.db
                .prepare(`UPDATE notifications SET is_read = 1 WHERE receiver = 'sales' AND salesperson_id = ? AND is_read = 0`)
                .bind(salespersonId)
                .run();
        }
        catch (error) {
            if (!isMissingColumnError(error, ['receiver', 'salesperson_id'])) {
                throw error;
            }
        }
    }
    /**
     * 通过 outbox source + dedupe key 查询已存在通知。
     * @param params 查询参数
     * @returns 已存在的通知，不存在时返回 null
     */
    async findBySourceDedupe({ sourceConsumer, dedupeKey, receiver, salespersonId = null }) {
        return this.db
            .prepare(`
        SELECT *
        FROM notifications
        WHERE source_consumer = ?
          AND dedupe_key = ?
          AND receiver = ?
          AND COALESCE(salesperson_id, '') = ?
        ORDER BY created_at DESC
        LIMIT 1
        `)
            .bind(sourceConsumer, dedupeKey, receiver, salespersonId || '')
            .first();
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
            metadata: parseJsonObject(n.metadata, null),
            created_at: n.created_at,
        };
    }
}
