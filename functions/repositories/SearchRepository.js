/**
 * 搜索仓库 (Search Repository)
 * ===================================
 *
 * 负责跨实体全文搜索的数据库查询。
 * 支持 FTS5 全文搜索，自动降级为 LIKE 模糊搜索。
 */
import { sanitizeFts5Query, checkFtsTable } from '../api/utils/fts.js';

/** 默认搜索结果条数 */
const DEFAULT_LIMIT = 10;

export class SearchRepository {
    /** @param {import('../types/database.js').D1Database} db */
    constructor(db) {
        this.db = db;
    }

    /**
     * 搜索文件（FTS5 全文搜索，失败时降级为 LIKE）
     * @param {string} query 搜索关键词
     * @param {Object} [options]
     * @param {number} [options.limit=10] 最大返回条数
     * @returns {Promise<Array>}
     */
    async searchFiles(query, { limit = DEFAULT_LIMIT } = {}) {
        const sanitized = sanitizeFts5Query(query);
        if (!sanitized) return [];

        try {
            const { results } = await this.db.prepare(`
                SELECT f.id, f.name, f.size, f.created_at,
                       f.storage_key, f.folder_id, f.mime_type, f.is_public,
                       'file' AS result_type
                FROM files f
                JOIN files_fts ON f.rowid = files_fts.rowid
                WHERE files_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            `).bind(`"${sanitized}"*`, limit).all();
            return results;
        } catch (err) {
            // FTS 查询失败，降级为 LIKE
            console.warn('[SearchRepository] FTS search failed, falling back to LIKE:', err.message);
            return this._fallbackSearchFiles(query, limit);
        }
    }

    /**
     * 搜索文件（LIKE 降级查询）
     * @param {string} query
     * @param {number} limit
     * @returns {Promise<Array>}
     * @private
     */
    async _fallbackSearchFiles(query, limit) {
        const pattern = `%${query}%`;
        const { results } = await this.db.prepare(`
            SELECT id, name, size, created_at,
                   storage_key, folder_id, mime_type, is_public,
                   'file' AS result_type
            FROM files
            WHERE name LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(pattern, limit).all();
        return results;
    }

    /**
     * 搜索商品（FTS5 全文搜索，降级为 LIKE）
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.limit=10]
     * @returns {Promise<Array>}
     */
    async searchProducts(query, { limit = DEFAULT_LIMIT } = {}) {
        const hasFts = await checkFtsTable(this.db, 'products_fts');
        if (hasFts) {
            const sanitized = sanitizeFts5Query(query);
            if (sanitized) {
                const { results } = await this.db.prepare(`
                    SELECT p.id, p.name, p.spu, p.created_at,
                           'product' AS result_type
                    FROM products p
                    JOIN products_fts ON p.rowid = products_fts.rowid
                    WHERE products_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                `).bind(`"${sanitized}"*`, limit).all();
                return results;
            }
        }

        // 降级为 LIKE
        const pattern = `%${query}%`;
        const { results } = await this.db.prepare(`
            SELECT id, name, spu, created_at,
                   'product' AS result_type
            FROM products
            WHERE name LIKE ? OR spu LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(pattern, pattern, limit).all();
        return results;
    }

    /**
     * 搜索订单（FTS5 全文搜索，降级为 LIKE）
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.limit=10]
     * @returns {Promise<Array>}
     */
    async searchOrders(query, { limit = DEFAULT_LIMIT } = {}) {
        const hasFts = await checkFtsTable(this.db, 'orders_fts');
        if (hasFts) {
            const sanitized = sanitizeFts5Query(query);
            if (sanitized) {
                const { results } = await this.db.prepare(`
                    SELECT o.id, o.order_no, o.status, o.created_at,
                           c.name AS customer_name,
                           'order' AS result_type
                    FROM orders o
                    LEFT JOIN customers c ON o.customer_id = c.id
                    WHERE o.rowid IN (SELECT rowid FROM orders_fts WHERE orders_fts MATCH ?)
                    ORDER BY o.created_at DESC
                    LIMIT ?
                `).bind(`"${sanitized}"*`, limit).all();
                return results;
            }
        }

        // 降级为 LIKE
        const pattern = `%${query}%`;
        const { results } = await this.db.prepare(`
            SELECT o.id, o.order_no, o.status, o.created_at,
                   c.name AS customer_name,
                   'order' AS result_type
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.order_no LIKE ? OR o.summary_name LIKE ?
            ORDER BY o.created_at DESC
            LIMIT ?
        `).bind(pattern, pattern, limit).all();
        return results;
    }

    /**
     * 搜索客户（FTS5 全文搜索，降级为 LIKE）
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.limit=10]
     * @returns {Promise<Array>}
     */
    async searchCustomers(query, { limit = DEFAULT_LIMIT } = {}) {
        const hasFts = await checkFtsTable(this.db, 'customers_fts');
        if (hasFts) {
            const sanitized = sanitizeFts5Query(query);
            if (sanitized) {
                const { results } = await this.db.prepare(`
                    SELECT c.id, c.name, c.phone, c.created_at,
                           'customer' AS result_type
                    FROM customers c
                    JOIN customers_fts ON c.rowid = customers_fts.rowid
                    WHERE customers_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                `).bind(`"${sanitized}"*`, limit).all();
                return results;
            }
        }

        // 降级为 LIKE
        const pattern = `%${query}%`;
        const { results } = await this.db.prepare(`
            SELECT id, name, phone, created_at,
                   'customer' AS result_type
            FROM customers
            WHERE name LIKE ? OR phone LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(pattern, pattern, limit).all();
        return results;
    }

    /**
     * 跨实体搜索（并行查询所有实体）
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.limit=10] 每个实体的最大返回条数
     * @returns {Promise<Array>}
     */
    async searchAll(query, { limit = DEFAULT_LIMIT } = {}) {
        const [files, products, orders, customers] = await Promise.all([
            this.searchFiles(query, { limit }),
            this.searchProducts(query, { limit }),
            this.searchOrders(query, { limit }),
            this.searchCustomers(query, { limit }),
        ]);
        return [...files, ...products, ...orders, ...customers];
    }
}
