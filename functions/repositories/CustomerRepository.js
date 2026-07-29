import { parseRepoPagination } from '../api/utils/pagination.js';
import { safeJsonParse } from '../api/utils/json.js';
import { hasChanges } from '../api/utils/result.js';
import { buildSetClause } from '../api/utils/sql.js';
import { checkFtsTable, sanitizeFts5Query } from '../api/utils/fts.js';
import { isUniqueConstraintError } from '../lib/db/errors.js';
import { MS_PER_DAY } from '../api/utils/constants.js';
/**
 * 客户仓库
 * 处理客户的 CRUD 和数据转换
 */
/**
 * 根据订单数和最近下单天数判断 RFM 分段
 */
function classifyRfmSegment(orderCount, recencyDays) {
    if (orderCount === 0)
        return 'new';
    if (recencyDays <= 90 && orderCount >= 5)
        return 'vip';
    if (recencyDays <= 90)
        return 'active';
    if (recencyDays <= 180)
        return 'at-risk';
    return 'lost';
}
export class CustomerRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * 批量根据 ID 查找客户
     * @param ids 客户 ID 列表
     * @returns 客户列表（仅返回存在的记录）
     */
    async findByIds(ids) {
        if (!ids.length)
            return [];
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await this.db
            .prepare(`SELECT * FROM customers WHERE id IN (${placeholders})`)
            .bind(...ids)
            .all();
        return results.map((customer) => {
            if (customer.tags) {
                const parsedTags = safeJsonParse(customer.tags, customer.tags);
                if (Array.isArray(parsedTags)) {
                    customer.tags = parsedTags;
                }
                else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
                    customer.tags = [parsedTags];
                }
                else {
                    customer.tags = [];
                }
            }
            else {
                customer.tags = [];
            }
            return customer;
        });
    }
    /**
     * 根据 ID 查找客户
     * @param id 客户 ID
     * @returns 客户对象，不存在时返回 null
     */
    async findById(id) {
        const customer = await this.db
            .prepare(`
            SELECT * FROM customers WHERE id = ?
        `)
            .bind(id)
            .first();
        if (customer) {
            if (customer.tags) {
                const parsedTags = safeJsonParse(customer.tags, customer.tags);
                if (Array.isArray(parsedTags)) {
                    customer.tags = parsedTags;
                }
                else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
                    customer.tags = [parsedTags];
                }
                else {
                    customer.tags = [];
                }
            }
            else {
                customer.tags = [];
            }
        }
        return customer;
    }
    /**
     * 获取客户列表 (分页)
     * @param params 分页和搜索参数
     * @returns 分页结果
     */
    async list({ page = 1, limit = 20, search = '' }) {
        const { limit: safeLimit, offset } = parseRepoPagination({ page, limit }, { defaultPage: 1, defaultLimit: 20, maxLimit: 100 });
        let whereClause = '1=1';
        const bindings = [];
        if (search) {
            // 优先使用 FTS5 全文搜索（O(logN)），不可用时降级为 LIKE（O(N)）
            const hasFts = await checkFtsTable(this.db, 'customers_fts');
            if (hasFts) {
                const sanitized = sanitizeFts5Query(search);
                if (sanitized) {
                    whereClause += ` AND rowid IN (SELECT rowid FROM customers_fts WHERE customers_fts MATCH ?)`;
                    bindings.push(`"${sanitized}"*`);
                }
            }
            else {
                whereClause += ' AND (name LIKE ? OR phone LIKE ? OR company LIKE ?)';
                const term = `%${search}%`;
                bindings.push(term, term, term);
            }
        }
        const [countResult, listResult] = await Promise.all([
            this.db
                .prepare(`
                SELECT COUNT(*) as total FROM customers WHERE ${whereClause}
            `)
                .bind(...bindings)
                .first(),
            this.db
                .prepare(`
                SELECT * FROM customers
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `)
                .bind(...bindings, safeLimit, offset)
                .all(),
        ]);
        const results = listResult.results.map((c) => {
            let tags = [];
            if (c.tags) {
                const parsedTags = safeJsonParse(c.tags, c.tags);
                if (Array.isArray(parsedTags)) {
                    tags = parsedTags;
                }
                else if (parsedTags !== null && parsedTags !== undefined && parsedTags !== '') {
                    tags = [parsedTags];
                }
            }
            return { ...c, tags };
        });
        return {
            results,
            total: countResult?.total ?? 0,
            pages: Math.ceil((countResult?.total ?? 0) / safeLimit),
        };
    }
    /**
     * 客户名称/手机搜索建议（轻量级，仅返回必要字段）
     * @param query 搜索关键词
     * @param limit 最大返回条数
     * @returns 客户建议列表
     */
    async suggest(query, limit = 10) {
        if (!query || !query.trim())
            return [];
        const term = `%${query.trim()}%`;
        const { results } = await this.db.prepare(`SELECT id, name, phone, company FROM customers
       WHERE name LIKE ? OR phone LIKE ? OR company LIKE ?
       ORDER BY name ASC LIMIT ?`).bind(term, term, term, limit).all();
        return results;
    }
    /**
     * 创建客户
     * @param data 客户数据
     * @returns 创建的客户对象
     */
    async create(data) {
        const id = crypto.randomUUID();
        const now = Date.now();
        const tags = data.tags ? JSON.stringify(data.tags) : '[]';
        await this.db
            .prepare(`
            INSERT INTO customers (id, name, phone, company, email, address, tags, remark, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
            .bind(id, data.name, data.phone || '', data.company || '', data.email || '', data.address || '', tags, data.remark || '', data.createdBy || 'admin', now, now)
            .run();
        return {
            id,
            ...data,
            tags: data.tags || [],
            created_at: now,
            updated_at: now,
        };
    }
    /**
     * 更新客户信息
     * @param id 客户 ID
     * @param data 更新数据
     * @returns 是否成功更新
     */
    async update(id, data) {
        const updateData = {};
        const fields = ['name', 'phone', 'company', 'email', 'address', 'remark'];
        fields.forEach((field) => {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        });
        if (data.tags !== undefined) {
            updateData.tags = JSON.stringify(data.tags);
        }
        if (Object.keys(updateData).length === 0)
            return false;
        updateData.updated_at = Date.now();
        const { clause, values } = buildSetClause(updateData);
        const result = await this.db
            .prepare(`
            UPDATE customers SET ${clause} WHERE id = ?
        `)
            .bind(...values, id)
            .run();
        if (hasChanges(result))
            return true;
        const existing = await this.db.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first();
        return Boolean(existing);
    }
    /**
     * 删除客户
     * @param id 客户 ID
     * @returns 是否成功删除
     */
    async delete(id) {
        const result = await this.db
            .prepare(`
            DELETE FROM customers WHERE id = ?
        `)
            .bind(id)
            .run();
        return hasChanges(result);
    }
    /**
     * 检查是否有关联订单
     * @param id 客户 ID
     * @returns 是否有订单
     */
    async hasOrders(id) {
        const result = await this.db
            .prepare(`
            SELECT COUNT(*) as count FROM orders WHERE archived_at IS NULL AND customer_id = ?
        `)
            .bind(id)
            .first();
        return (result?.count ?? 0) > 0;
    }
    /**
     * 获取客户订单统计
     * @param id 客户 ID
     * @returns 订单统计数据
     */
    async getOrderStats(id) {
        const stats = await this.db
            .prepare(`
          SELECT
            COUNT(o.id) AS order_count,
            MIN(o.created_at) AS first_order_at,
            MAX(o.created_at) AS last_order_at
          FROM orders o
          WHERE o.archived_at IS NULL AND o.customer_id = ?
        `)
            .bind(id)
            .first();
        const now = Date.now();
        const lastOrderAt = stats.last_order_at || null;
        const recencyDays = lastOrderAt ? Math.floor((now - lastOrderAt) / MS_PER_DAY) : null;
        return {
            orderCount: stats.order_count || 0,
            firstOrderAt: stats.first_order_at || null,
            lastOrderAt: lastOrderAt,
            recencyDays,
        };
    }
    /**
     * 获取客户最常订购的商品
     * @param id 客户 ID
     * @param limit 返回数量限制
     * @returns 常用商品列表
     */
    async getFavoriteProducts(id, limit = 5) {
        const { results } = await this.db
            .prepare(`
          SELECT
            o.product_id,
            o.summary_name AS product_name,
            COUNT(*) AS order_count
          FROM orders o
          WHERE o.archived_at IS NULL AND o.customer_id = ? AND o.product_id IS NOT NULL
          GROUP BY o.product_id
          ORDER BY order_count DESC
          LIMIT ?
        `)
            .bind(id, limit)
            .all();
        return results.map((r) => ({
            productId: r.product_id,
            productName: r.product_name || '',
            orderCount: r.order_count,
        }));
    }
    /**
     * RFM 分段：根据客户订单数据自动分类
     * @param id 客户 ID
     * @returns RFM 数据和分段标签
     */
    async getRfmSegment(id) {
        const stats = await this.getOrderStats(id);
        const { orderCount, recencyDays } = stats;
        const segment = classifyRfmSegment(orderCount, recencyDays);
        return {
            ...stats,
            segment,
        };
    }
    /**
     * 批量获取多个客户的 RFM 分段（用于列表展示）
     * @param ids 客户 ID 列表
     * @returns 客户 ID 到 RFM 数据的映射
     */
    async getBatchRfmSegments(ids) {
        if (!ids.length)
            return new Map();
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await this.db
            .prepare(`
          SELECT
            c.id AS customer_id,
            COUNT(o.id) AS order_count,
            MAX(o.created_at) AS last_order_at
          FROM customers c
          LEFT JOIN orders o ON o.customer_id = c.id AND o.archived_at IS NULL
          WHERE c.id IN (${placeholders})
          GROUP BY c.id
        `)
            .bind(...ids)
            .all();
        const now = Date.now();
        const segmentMap = new Map();
        for (const row of results) {
            const orderCount = row.order_count || 0;
            const lastOrderAt = row.last_order_at || null;
            const recencyDays = lastOrderAt ? Math.floor((now - lastOrderAt) / MS_PER_DAY) : null;
            const segment = classifyRfmSegment(orderCount, recencyDays);
            segmentMap.set(row.customer_id, { segment, orderCount, lastOrderAt, recencyDays });
        }
        // 确保所有请求的 ID 都有结果
        for (const id of ids) {
            if (!segmentMap.has(id)) {
                segmentMap.set(id, { segment: 'new', orderCount: 0, lastOrderAt: null, recencyDays: null });
            }
        }
        return segmentMap;
    }
    // ========================================
    // 标签管理 (Tags CRUD)
    // ========================================
    /**
     * 获取客户的所有标签
     * @param customerId 客户 ID
     * @returns 标签列表
     */
    async getTags(customerId) {
        const { results } = await this.db
            .prepare('SELECT id, tag_name, created_at FROM customer_tags WHERE customer_id = ? ORDER BY created_at DESC')
            .bind(customerId)
            .all();
        return results.map((r) => ({ id: r.id, name: r.tag_name, createdAt: r.created_at }));
    }
    /**
     * 添加标签
     * @param customerId 客户 ID
     * @param tagName 标签名称
     * @returns 新标签，已存在时返回 null
     */
    async addTag(customerId, tagName) {
        const now = Date.now();
        try {
            await this.db
                .prepare('INSERT INTO customer_tags (customer_id, tag_name, created_at) VALUES (?, ?, ?)')
                .bind(customerId, tagName, now)
                .run();
            return { customer_id: customerId, tag_name: tagName, created_at: now };
        }
        catch (e) {
            // UNIQUE 约束冲突 → 标签已存在，忽略
            if (isUniqueConstraintError(e))
                return null;
            throw e;
        }
    }
    /**
     * 删除标签
     * @param customerId 客户 ID
     * @param tagName 标签名称
     * @returns 是否成功删除
     */
    async removeTag(customerId, tagName) {
        const result = await this.db
            .prepare('DELETE FROM customer_tags WHERE customer_id = ? AND tag_name = ?')
            .bind(customerId, tagName)
            .run();
        return result.meta.changes > 0;
    }
    /**
     * 获取所有客户使用过的标签列表（去重）
     * @returns 标签列表（含使用次数）
     */
    async getAllTags() {
        const { results } = await this.db
            .prepare('SELECT DISTINCT tag_name, COUNT(*) as usage_count FROM customer_tags GROUP BY tag_name ORDER BY usage_count DESC')
            .all();
        return results.map((r) => ({ name: r.tag_name, usageCount: r.usage_count }));
    }
    // ========================================
    // 沟通记录 (Communications)
    // ========================================
    /**
     * 获取客户沟通记录（分页）
     * @param customerId 客户 ID
     * @param params 分页参数
     * @returns 分页结果
     */
    async getCommunications(customerId, { page = 1, limit = 20 } = {}) {
        const { limit: safeLimit, offset } = parseRepoPagination({ page, limit }, { defaultPage: 1, defaultLimit: 20, maxLimit: 100 });
        const [countResult, listResult] = await Promise.all([
            this.db
                .prepare('SELECT COUNT(*) as total FROM customer_communications WHERE customer_id = ?')
                .bind(customerId)
                .first(),
            this.db
                .prepare('SELECT * FROM customer_communications WHERE customer_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
                .bind(customerId, safeLimit, offset)
                .all(),
        ]);
        return {
            results: listResult.results,
            total: countResult.total,
        };
    }
    /**
     * 添加沟通记录
     * @param customerId 客户 ID
     * @param type 记录类型
     * @param content 记录内容
     * @param createdBy 创建人
     * @returns 新记录
     */
    async addCommunication(customerId, type, content, createdBy) {
        const id = crypto.randomUUID();
        const now = Date.now();
        await this.db
            .prepare('INSERT INTO customer_communications (id, customer_id, type, content, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(id, customerId, type, content, now, createdBy || null)
            .run();
        return { id, customer_id: customerId, type, content, created_at: now, created_by: createdBy || null };
    }
    /**
     * 删除沟通记录
     * @param id 记录 ID
     * @returns 是否成功删除
     */
    async deleteCommunication(id) {
        const result = await this.db
            .prepare('DELETE FROM customer_communications WHERE id = ?')
            .bind(id)
            .run();
        return hasChanges(result);
    }
}
