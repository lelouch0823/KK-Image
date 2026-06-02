
import { parseRepoPagination } from '../api/utils/pagination.js';
import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { buildSetClause } from '../api/utils/sql.js';
import { hasChanges } from '../api/utils/result.js';
import { generateId } from '../api/utils/id.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { execute, query, queryFirst } from '../lib/db/query.js';

export class ProductRepository {
    /** @type {boolean|null} FTS5 可用性缓存 */
    static _ftsAvailable = null;

    /** 商品生命周期状态常量 */
    static VALID_STATUSES = Object.freeze(['draft', 'active', 'archived']);

    static PRODUCT_SORT_FIELDS = Object.freeze({
        price: 'price',
        stock: 'available_quantity',
        updatedAt: 'p.updated_at',
        name: 'p.name COLLATE NOCASE',
    });

    constructor(db) {
        this.db = db;
    }

    /**
     * 检查 FTS5 虚拟表是否存在（带模块级缓存）
     * @returns {Promise<boolean>}
     */
    async _hasFtsTable() {
        if (ProductRepository._ftsAvailable !== null) return ProductRepository._ftsAvailable;
        try {
            const stmt = this.db.prepare?.("SELECT name FROM sqlite_master WHERE type='table' AND name='products_fts'");
            if (!stmt) { ProductRepository._ftsAvailable = false; return false; }
            const result = await stmt.first();
            ProductRepository._ftsAvailable = !!result;
        } catch {
            ProductRepository._ftsAvailable = false;
        }
        return ProductRepository._ftsAvailable;
    }

    static PRODUCT_CURRENCY_SET = new Set(['CNY', 'USD', 'EUR', 'GBP', 'JPY']);

    normalizeCurrency(value, { allowEmpty = true } = {}) {
        const normalized = String(value ?? '').trim().toUpperCase();
        if (!normalized) return allowEmpty ? 'CNY' : null;
        if (!ProductRepository.PRODUCT_CURRENCY_SET.has(normalized)) {
            return null;
        }
        return normalized;
    }

    /**
     * @deprecated 使用 product_projection 表替代，保留用于数据验证
     */
    _variantAggregateCTE() {
        return `
            WITH variant_agg AS (
                SELECT
                    pv.product_id,
                    MIN(CASE WHEN pv.status = 'active' THEN price END) AS min_price,
                    MIN(CASE WHEN pv.status = 'active' THEN COALESCE(cost_price, 0) END) AS min_cost_price,
                    SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.on_hand, pv.stock_quantity, 0) ELSE 0 END) AS total_stock_quantity,
                    SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.available, pv.stock_quantity, 0) ELSE 0 END) AS total_available_quantity,
                    MIN(CASE WHEN pv.status = 'active' THEN COALESCE(alert_threshold, 10) END) AS min_alert_threshold,
                    SUM(CASE WHEN pv.status = 'active' THEN 1 ELSE 0 END) AS active_variant_count
                FROM product_variants pv
                LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
                GROUP BY pv.product_id
            )
        `;
    }

    /**
     * 使用 product_projection 表的 SELECT SQL（O(1) 查找替代 O(M) 全表 GROUP BY）
     */
    _productSelectSQL(whereClause = '1=1') {
        return `
            SELECT
                p.*,
                COALESCE(pp.min_price, 0) AS price,
                COALESCE(pp.min_cost_price, 0) AS cost_price,
                COALESCE(pp.total_stock, 0) AS stock_quantity,
                COALESCE(pp.total_available, COALESCE(pp.total_stock, 0)) AS available_quantity,
                COALESCE(pp.min_alert_threshold, 10) AS alert_threshold
            FROM products p
            LEFT JOIN product_projection pp ON pp.product_id = p.id
            WHERE ${whereClause}
        `;
    }

    _productCountSQL(whereClause = '1=1') {
        return `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN product_projection pp ON pp.product_id = p.id
            WHERE ${whereClause}
        `;
    }

    async buildProductFilterClause(filters = {}, { omit = [] } = {}) {
        const clauses = [];
        const params = [];

        if (filters.status && !omit.includes('status')) {
            clauses.push('p.status = ?');
            params.push(filters.status);
        }

        if (filters.category && !omit.includes('category')) {
            clauses.push('p.category = ?');
            params.push(filters.category);
        }

        if (filters.brand && !omit.includes('brand')) {
            clauses.push('p.brand = ?');
            params.push(filters.brand);
        }

        if (filters.search && !omit.includes('search')) {
            // 优先使用 FTS5 全文搜索（O(logN)），不可用时降级为 LIKE（O(N)）
            const hasFts = await this._hasFtsTable();
            if (hasFts) {
                const sanitized = String(filters.search).replace(/"/g, '""');
                const ftsQuery = `"${sanitized}"*`;
                clauses.push('p.rowid IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)');
                params.push(ftsQuery);
            } else {
                clauses.push('(p.name LIKE ? OR p.spu LIKE ? OR p.series LIKE ?)');
                const term = `%${filters.search}%`;
                params.push(term, term, term);
            }
        }

        if (filters.hasStock === 'in_stock' && !omit.includes('hasStock')) {
            clauses.push('COALESCE(pp.total_available, COALESCE(pp.total_stock, 0)) > 0');
        } else if (filters.hasStock === 'out_of_stock' && !omit.includes('hasStock')) {
            clauses.push('COALESCE(pp.total_available, COALESCE(pp.total_stock, 0)) <= 0');
        }

        return {
            clause: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
            params,
        };
    }

    async listAvailableBrands(filters = {}) {
        const { clause, params } = await this.buildProductFilterClause(filters, { omit: ['brand'] });
        const sql = `
            SELECT DISTINCT p.brand AS brand
            FROM products p
            LEFT JOIN product_projection pp ON pp.product_id = p.id
            WHERE ${clause}
              AND p.brand IS NOT NULL
              AND p.brand != ''
            ORDER BY p.brand COLLATE NOCASE
        `;
        const result = await query(this.db, sql, params, {
            label: 'product.search.filters.brands',
        });
        return (result.results || []).map((row) => row.brand).filter(Boolean);
    }

    async listAvailableCategories(filters = {}) {
        const { clause, params } = await this.buildProductFilterClause(filters, { omit: ['category'] });
        const sql = `
            SELECT DISTINCT p.category AS category
            FROM products p
            LEFT JOIN product_projection pp ON pp.product_id = p.id
            WHERE ${clause}
              AND p.category IS NOT NULL
              AND p.category != ''
            ORDER BY p.category COLLATE NOCASE
        `;
        const result = await query(this.db, sql, params, {
            label: 'product.search.filters.categories',
        });
        return (result.results || []).map((row) => row.category).filter(Boolean);
    }

    /**
     * 创建商品
     * @param {Object} data 
     */
    async create(data) {
        const now = Date.now();
        const id = generateId();
        const currency = this.normalizeCurrency(data.currency);
        if (!currency) {
            throw new Error('Invalid currency code');
        }

        const product = {
            id,
            name: data.name,
            spu: data.spu || null,
            slug: data.slug || null,
            category: data.category || null,
            brand: data.brand || null,
            series: data.series || null,
            currency,
            description: data.description || '',
            images: JSON.stringify(data.images || []),
            specifications: JSON.stringify(data.specifications || {}),
            options: JSON.stringify(data.options || []),
            status: data.status || 'draft',
            created_at: now,
            updated_at: now
        };

        const keys = Object.keys(product);
        const placeholders = keys.map(() => '?').join(', ');
        const values = Object.values(product);

        const query = `INSERT INTO products (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;

        const result = await execute(this.db, query, values, {
            label: 'product.create',
        });

        // 新创建的商品无 variants，派生字段使用默认值（省去写后读回的 findById 调用）
        // product_code 由数据库 trigger 生成，应用层计算一致的值
        const inserted = result.results?.[0] || product;
        const product_code = 'P' + id.replace(/-/g, '').toUpperCase().slice(0, 12);
        return {
            ...inserted,
            product_code: inserted.product_code || product_code,
            price: 0,
            cost_price: 0,
            stock_quantity: 0,
            available_quantity: 0,
            alert_threshold: 10,
        };
    }
    /**
     * 批量创建商品
     * @param {Array<Object>} items 
     * @returns {Promise<{success: boolean, count: number, errors: Array}>}
     */
    async createBatch(items) {
        if (!items || items.length === 0) return { success: true, count: 0, errors: [] };

        const now = Date.now();
        const stmts = [];
        const errors = [];
        const validItems = [];

        // 1. Prepare data
        for (const data of items) {
            // Basic validation
            if (!data.name) {
                errors.push({ spu: data.spu || 'UNKNOWN', error: 'Missing name' });
                continue;
            }

            const id = generateId();
            const currency = this.normalizeCurrency(data.currency);
            if (!currency) {
                errors.push({ spu: data.spu || 'UNKNOWN', error: 'Invalid currency code' });
                continue;
            }
            validItems.push({
                data,
                id
            });

            const product = {
                id,
                name: data.name,
                spu: data.spu || null,
                slug: data.slug || null,
                category: data.category || null,
                brand: data.brand || null,
                series: data.series || null,
                currency,
                description: data.description || '',
                images: JSON.stringify(data.images || []),
                specifications: JSON.stringify(data.specifications || {}),
                options: JSON.stringify(data.options || []),
                status: data.status || 'draft',
                created_at: now,
                updated_at: now
            };

            const keys = Object.keys(product);
            const placeholders = keys.map(() => '?').join(', ');
            const values = Object.values(product);

            // Use INSERT OR IGNORE to skip duplicates elegantly, or we could handle errors.
            // For now, let's try standard INSERT and let batch fail if strict.
            // Actually, D1 batch is all-or-nothing by default unless we handle it cautiously.
            // But to avoid one dup killing the whole batch, INSERT OR IGNORE is safer for "import".
            const query = `INSERT OR IGNORE INTO products (${keys.join(', ')}) VALUES (${placeholders})`;
            stmts.push(this.db.prepare(query).bind(...values));
        }

        if (stmts.length === 0) {
            return { success: false, count: 0, errors };
        }

        try {
            // 2. Execute batch
            const results = await executeBatchChunks(this.db, stmts);

            // 3. Count successes (check changes)
            let successCount = 0;
            results.forEach((res, index) => {
                if (res.success) {
                    if (res.meta && res.meta.changes > 0) {
                        successCount++;
                    } else {
                        // If changes is 0, it means INSERT OR IGNORE ignored it (duplicate)
                        errors.push({ spu: validItems[index].data.spu, error: 'Duplicate SPU or insert failed' });
                    }
                } else {
                    errors.push({ spu: validItems[index].data.spu, error: 'Database error' });
                }
            });

            return { success: true, count: successCount, errors };

        } catch (e) {
            console.error('[ProductRepository.createBatch] Error:', e);
            return { success: false, count: 0, errors: [{ error: e.message }] };
        }
    }

    /**
     * 更新商品
     * @param {string} id 
     * @param {Object} updates 
     */
    async update(id, updates) {
        const result = await this.updateWithMeta(id, updates);
        return result.success && result.changes > 0;
    }

    /**
     * 更新商品 (带元数据)
     * @param {string} id 
     * @param {Object} updates 
     * @returns {Promise<{success: boolean, changes: number, error?: string}>}
     */
    async updateWithMeta(id, updates) {
        const built = this._buildUpdateParams(id, updates);
        if (built.error) {
            return { success: false, changes: 0, error: built.error };
        }

        try {
            const result = await execute(
                this.db,
                `UPDATE products SET ${built.clause} WHERE id = ?`,
                built.values,
                { label: 'product.update' }
            );

            return {
                success: result.success,
                changes: hasChanges(result) ? (result.meta?.changes || 0) : 0,
            };
        } catch (e) {
            console.error('[ProductRepository.updateWithMeta] Error:', e);
            return { success: false, changes: 0, error: e.message };
        }
    }

    /**
     * 更新商品状态
     * @param {string} id
     * @param {string} status - draft | active | archived
     * @returns {Promise<{success: boolean, changes: number, error?: string}>}
     */
    async updateStatus(id, status) {
        if (!ProductRepository.VALID_STATUSES.includes(status)) {
            return { success: false, changes: 0, error: `Invalid status: ${status}. Valid values: ${ProductRepository.VALID_STATUSES.join(', ')}` };
        }
        const now = Date.now();
        try {
            const result = await execute(
                this.db,
                'UPDATE products SET status = ?, updated_at = ? WHERE id = ?',
                [status, now, id],
                { label: 'product.updateStatus' }
            );
            return {
                success: result.success,
                changes: hasChanges(result) ? (result.meta?.changes || 0) : 0,
            };
        } catch (e) {
            console.error('[ProductRepository.updateStatus] Error:', e);
            return { success: false, changes: 0, error: e.message };
        }
    }

    /**
     * 根据 SPU 查找
     * @param {string} spu
     */
    async findBySpu(spu) {
        const result = await queryFirst(
            this.db,
            this._productSelectSQL('p.spu = ?'),
            [spu],
            { label: 'product.findBySpu' }
        );
        return this._parseResult(result);
    }

    async findBySpuBatch(spus = []) {
        const normalizedSpus = [...new Set((Array.isArray(spus) ? spus : [])
            .map((spu) => String(spu || '').trim())
            .filter(Boolean))];
        const productsBySpu = new Map();
        if (normalizedSpus.length === 0) return productsBySpu;

        for (const spuChunk of chunkArray(normalizedSpus, 100)) {
            const placeholders = spuChunk.map(() => '?').join(', ');
            const result = await query(
                this.db,
                this._productSelectSQL(`p.spu IN (${placeholders})`),
                spuChunk,
                { label: 'product.findBySpuBatch' }
            );
            for (const row of result.results || []) {
                const parsed = this._parseResult(row);
                const key = String(parsed?.spu || '').trim();
                if (key) {
                    productsBySpu.set(key, parsed);
                }
            }
        }

        return productsBySpu;
    }

    async bulkUpsertFromImport(plans = []) {
        const planList = Array.isArray(plans) ? plans : [];
        const successes = [];
        const failures = [];
        const batchEntries = []; // { plan, statement }

        // Phase 1: 验证所有计划并构建 statements
        for (const plan of planList) {
            const operation = String(plan?.operation || '').trim();
            const productId = String(plan?.productId || '').trim();
            const productData = plan?.productData || {};
            const needsProductUpsert = plan?.needsProductUpsert !== false;

            if (!needsProductUpsert) {
                successes.push({ itemKey: plan?.itemKey, operation, productId });
                continue;
            }

            try {
                if (operation === 'created') {
                    const now = Date.now();
                    const currency = this.normalizeCurrency(productData.currency);
                    if (!currency) throw new Error('Invalid currency code');

                    const payload = {
                        id: productId,
                        name: productData.name,
                        spu: productData.spu || null,
                        slug: productData.slug || null,
                        category: productData.category || null,
                        brand: productData.brand || null,
                        series: productData.series || null,
                        currency,
                        description: productData.description || '',
                        images: JSON.stringify(productData.images || []),
                        specifications: JSON.stringify(productData.specifications || {}),
                        options: JSON.stringify(productData.options || []),
                        status: productData.status || 'draft',
                        created_at: now,
                        updated_at: now,
                    };
                    const keys = Object.keys(payload);
                    const placeholders = keys.map(() => '?').join(', ');
                    batchEntries.push({
                        plan,
                        statement: this.db
                            .prepare(`INSERT INTO products (${keys.join(', ')}) VALUES (${placeholders})`)
                            .bind(...Object.values(payload)),
                    });
                } else if (operation === 'updated') {
                    const updateResult = this._buildUpdateParams(productId, productData);
                    if (updateResult.error) throw new Error(updateResult.error);
                    batchEntries.push({
                        plan,
                        statement: this.db
                            .prepare(`UPDATE products SET ${updateResult.clause} WHERE id = ?`)
                            .bind(...updateResult.values),
                    });
                } else {
                    throw new Error('Unsupported product import operation');
                }
            } catch (error) {
                failures.push({
                    itemKey: plan?.itemKey,
                    operation: plan?.operation,
                    productId: plan?.productId || null,
                    error,
                });
            }
        }

        // Phase 2: 按 chunk 独立批量执行，区分已提交和未提交的条目
        // 每个 chunk 独立 try/catch，chunk N 失败不影响 chunk N-1 的成功记录
        if (batchEntries.length > 0) {
            const chunks = chunkArray(batchEntries, 100);
            for (const chunk of chunks) {
                try {
                    await executeBatchChunks(
                        this.db,
                        chunk.map((e) => e.statement)
                    );
                    for (const entry of chunk) {
                        successes.push({
                            itemKey: entry.plan?.itemKey,
                            operation: entry.plan?.operation,
                            productId: entry.plan?.productId,
                        });
                    }
                } catch (error) {
                    // 仅当前 chunk 的条目标记为失败，已提交的 chunk 保持成功
                    for (const entry of chunk) {
                        failures.push({
                            itemKey: entry.plan?.itemKey,
                            operation: entry.plan?.operation,
                            productId: entry.plan?.productId || null,
                            error,
                        });
                    }
                }
            }
        }

        return { successes, failures };
    }

    /**
     * 构建商品更新参数（不执行）
     * @returns {{ clause: string, values: any[], error: null } | { clause: null, values: null, error: string }}
     */
    _buildUpdateParams(id, updates) {
        const allowedFields = [
            'name', 'spu', 'slug', 'category', 'brand', 'series',
            'currency', 'description', 'images', 'specifications', 'options',
            'status',
        ];

        const updateData = {};
        const now = Date.now();

        for (const [key, value] of Object.entries(updates)) {
            if (!allowedFields.includes(key)) continue;
            if (['images', 'specifications', 'options'].includes(key) && typeof value === 'object') {
                updateData[key] = JSON.stringify(value);
            } else if (key === 'currency') {
                const normalizedCurrency = this.normalizeCurrency(value, { allowEmpty: false });
                if (!normalizedCurrency) return { clause: null, values: null, error: 'Invalid currency code' };
                updateData[key] = normalizedCurrency;
            } else if (key === 'status') {
                if (!ProductRepository.VALID_STATUSES.includes(value)) {
                    return { clause: null, values: null, error: `Invalid status: ${value}. Valid values: ${ProductRepository.VALID_STATUSES.join(', ')}` };
                }
                updateData[key] = value;
            } else {
                updateData[key] = value;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return { clause: null, values: null, error: 'No valid fields to update' };
        }

        updateData.updated_at = now;
        const { clause, values } = buildSetClause(updateData);
        return { clause, values: [...values, id], error: null };
    }

    /**
     * 根据 ID 查找
     * @param {string} id
     */
    async findById(id) {
        const result = await queryFirst(
            this.db,
            this._productSelectSQL('p.id = ?'),
            [id],
            { label: 'product.findById' }
        );
        return this._parseResult(result);
    }

    /**
     * 根据条件搜索
     * @param {Object} filters { search, category, brand, status, page, limit }
     */
    async search(filters = {}, options = {}) {
        const { includeFilters = true } = options;
        const { page: safePage, limit: safeLimit, offset } = parseRepoPagination(
            { page: filters.page, limit: filters.limit },
            { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
        );
        const normalizedSortOrder = String(filters.sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const requestedSortField = ProductRepository.PRODUCT_SORT_FIELDS[filters.sortBy];

        const { clause, params } = await this.buildProductFilterClause(filters);
        let listQuery = this._productSelectSQL(clause);

        const countQuery = this._productCountSQL(clause);
        const countParams = [...params];

        if (requestedSortField) {
            listQuery += ` ORDER BY ${requestedSortField} ${normalizedSortOrder}, p.created_at DESC`;
        } else {
            listQuery += ' ORDER BY p.created_at DESC';
        }
        listQuery += ' LIMIT ? OFFSET ?';
        params.push(safeLimit, offset);

        let results;
        let countResult;
        let brands = [];
        let categories = [];

        if (includeFilters) {
            [results, countResult, brands, categories] = await Promise.all([
                query(this.db, listQuery, params, { label: 'product.search.list' }),
                queryFirst(this.db, countQuery, countParams, { label: 'product.search.count' }),
                this.listAvailableBrands(filters),
                this.listAvailableCategories(filters),
            ]);
        } else {
            [results, countResult] = await Promise.all([
                query(this.db, listQuery, params, { label: 'product.search.list' }),
                queryFirst(this.db, countQuery, countParams, { label: 'product.search.count' }),
            ]);
        }

        return {
            items: (results.results || []).map(item => this._parseResult(item)),
            total: countResult.total,
            page: safePage,
            limit: safeLimit,
            totalPages: Math.ceil((countResult?.total || 0) / safeLimit),
            filters: {
                brands,
                categories,
            },
        };
    }

    _parseResult(item) {
        if (!item) return null;
        try {
            return {
                ...item,
                images: parseJsonArray(item.images, []),
                specifications: parseJsonObject(item.specifications, {}),
                options: parseJsonArray(item.options, []),
            };
        } catch (e) {
            console.error('Error parsing product JSON:', e);
            // 返回安全默认值，避免将未解析的字符串暴露给调用方
            return {
                ...item,
                images: [],
                specifications: {},
                options: [],
            };
        }
    }

    /**
     * 商品名称搜索建议（轻量级，仅返回必要字段）
     * @param {string} query 搜索关键词
     * @param {number} [limit=10] 最大返回条数
     * @returns {Promise<Array<{id: string, name: string, brand: string, spu: string}>>}
     */
    async suggest(query, limit = 10) {
        if (!query || !query.trim()) return [];
        const term = `%${query.trim()}%`;
        const { results } = await this.db.prepare(
            `SELECT id, name, brand, spu FROM products
             WHERE name LIKE ? OR brand LIKE ? OR spu LIKE ?
             ORDER BY name ASC LIMIT ?`
        ).bind(term, term, term, limit).all();
        return results;
    }
}
