
export class ProductRepository {
    constructor(db) {
        this.db = db;
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

    _variantAggregateCTE() {
        return `
            WITH variant_agg AS (
                SELECT
                    product_id,
                    MIN(price) AS min_price,
                    MIN(COALESCE(cost_price, 0)) AS min_cost_price,
                    SUM(COALESCE(stock_quantity, 0)) AS total_stock_quantity,
                    MIN(COALESCE(alert_threshold, 10)) AS min_alert_threshold,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_variant_count
                FROM product_variants
                GROUP BY product_id
            )
        `;
    }

    _productSelectSQL(whereClause = '1=1') {
        return `
            ${this._variantAggregateCTE()}
            SELECT
                p.*,
                COALESCE(va.min_price, 0) AS price,
                COALESCE(va.min_cost_price, 0) AS cost_price,
                COALESCE(va.total_stock_quantity, 0) AS stock_quantity,
                COALESCE(va.min_alert_threshold, 10) AS alert_threshold,
                CASE WHEN COALESCE(va.active_variant_count, 0) > 0 THEN 'active' ELSE 'archived' END AS derived_status
            FROM products p
            LEFT JOIN variant_agg va ON va.product_id = p.id
            WHERE ${whereClause}
        `;
    }

    /**
     * 创建商品
     * @param {Object} data 
     */
    async create(data) {
        const now = Date.now();
        const id = crypto.randomUUID();
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
            created_at: now,
            updated_at: now
        };

        const keys = Object.keys(product);
        const placeholders = keys.map(() => '?').join(', ');
        const values = Object.values(product);

        const query = `INSERT INTO products (${keys.join(', ')}) VALUES (${placeholders})`;

        await this.db.prepare(query).bind(...values).run();

        const inserted = await this.findById(id);
        return inserted || product;
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

            const id = crypto.randomUUID();
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
            const results = await this.db.batch(stmts);

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
        const allowedFields = [
            'name', 'spu', 'slug', 'category', 'brand', 'series',
            'currency', 'description', 'images', 'specifications', 'options'
        ];

        const updateData = {};
        const now = Date.now();

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // Handle JSON fields
                if (['images', 'specifications', 'options'].includes(key) && typeof value === 'object') {
                    updateData[key] = JSON.stringify(value);
                } else if (key === 'currency') {
                    const normalizedCurrency = this.normalizeCurrency(value, { allowEmpty: false });
                    if (!normalizedCurrency) {
                        return { success: false, changes: 0, error: 'Invalid currency code' };
                    }
                    updateData[key] = normalizedCurrency;
                } else {
                    updateData[key] = value;
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            return { success: false, changes: 0, error: 'No valid fields to update' };
        }

        updateData.updated_at = now;

        const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updateData), id];

        try {
            const result = await this.db.prepare(`UPDATE products SET ${sets} WHERE id = ?`)
                .bind(...values)
                .run();

            return {
                success: result.success,
                changes: result.meta?.changes || 0
            };
        } catch (e) {
            console.error('[ProductRepository.updateWithMeta] Error:', e);
            return { success: false, changes: 0, error: e.message };
        }
    }

    /**
     * 根据 SPU 查找
     * @param {string} spu 
     */
    async findBySpu(spu) {
        const result = await this.db.prepare(this._productSelectSQL('p.spu = ?')).bind(spu).first();
        return this._parseResult(result);
    }

    /**
     * 根据 ID 查找
     * @param {string} id
     */
    async findById(id) {
        const result = await this.db.prepare(this._productSelectSQL('p.id = ?')).bind(id).first();
        return this._parseResult(result);
    }

    /**
     * 原子增减库存
     * @param {string} productId
     * @param {number} delta - 正数加库存，负数减库存
     */
    async adjustStock(productId, delta) {
        const now = Date.now();
        const result = await this.db.prepare(
            `UPDATE product_variants
             SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
             WHERE product_id = ?`
        ).bind(delta, now, productId).run();
        return (result.meta?.changes || 0) > 0;
    }

    /**
     * 根据条件搜索
     * @param {Object} filters { search, category, brand, status, page, limit }
     */
    async search(filters = {}) {
        // 验证分页参数
        const safePage = Math.max(1, Math.floor(Number(filters.page) || 1));
        const safeLimit = filters.limit ? Math.min(100, Math.max(1, Math.floor(Number(filters.limit)))) : 0;

        let query = this._productSelectSQL('1=1');
        const params = [];

        if (filters.status) {
            query += " AND (CASE WHEN COALESCE(va.active_variant_count, 0) > 0 THEN 'active' ELSE 'archived' END) = ?";
            params.push(filters.status);
        }

        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        if (filters.brand) {
            query += ' AND brand = ?';
            params.push(filters.brand);
        }

        if (filters.search) {
            query += ' AND (name LIKE ? OR spu LIKE ? OR series LIKE ?)';
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }

        const countQuery = `SELECT COUNT(*) as total FROM (${query}) q`;
        const countParams = [...params];

        query += ' ORDER BY p.created_at DESC';

        if (safeLimit > 0) {
            query += ' LIMIT ? OFFSET ?';
            params.push(safeLimit, (safePage - 1) * safeLimit);
        }

        const results = await this.db.prepare(query).bind(...params).all();

        const countResult = await this.db.prepare(countQuery)
            .bind(...countParams)
            .first();

        return {
            items: (results.results || []).map(item => this._parseResult(item)),
            total: countResult.total
        };
    }

    _parseResult(item) {
        if (!item) return null;
        try {
            return {
                ...item,
                status: item.derived_status || item.status,
                images: JSON.parse(item.images || '[]'),
                specifications: JSON.parse(item.specifications || '{}'),
                options: JSON.parse(item.options || '[]'),
            };
        } catch (e) {
            console.error('Error parsing product JSON:', e);
            return item;
        }
    }
}
