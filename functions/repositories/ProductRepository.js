
export class ProductRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 创建商品
     * @param {Object} data 
     */
    async create(data) {
        const now = Date.now();
        const id = crypto.randomUUID();

        const product = {
            id,
            name: data.name,
            sku: data.sku,
            slug: data.slug || null,
            category: data.category || null,
            brand: data.brand || null,
            series: data.series || null,
            price: data.price || 0,
            cost_price: data.costPrice || null,
            stock_quantity: data.stockQuantity || 0,
            alert_threshold: data.alertThreshold || 10,
            description: data.description || '',
            images: JSON.stringify(data.images || []),
            specifications: JSON.stringify(data.specifications || {}),
            status: data.status || 'active',
            created_at: now,
            updated_at: now
        };

        const keys = Object.keys(product);
        const placeholders = keys.map(() => '?').join(', ');
        const values = Object.values(product);

        const query = `INSERT INTO products (${keys.join(', ')}) VALUES (${placeholders})`;

        await this.db.prepare(query).bind(...values).run();

        return product;
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
            if (!data.name || !data.sku) {
                errors.push({ sku: data.sku || 'UNKNOWN', error: 'Missing name or sku' });
                continue;
            }

            const id = crypto.randomUUID();
            validItems.push({
                data,
                id
            });

            const product = {
                id,
                name: data.name,
                sku: data.sku,
                slug: data.slug || null,
                category: data.category || null,
                brand: data.brand || null,
                series: data.series || null,
                price: Number(data.price) || 0,
                cost_price: data.cost_price ? Number(data.cost_price) : null,
                stock_quantity: data.stock_quantity ? Number(data.stock_quantity) : 0,
                alert_threshold: data.alert_threshold ? Number(data.alert_threshold) : 10,
                description: data.description || '',
                images: JSON.stringify(data.images || []),
                specifications: JSON.stringify(data.specifications || {}),
                status: data.status || 'active',
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
                        errors.push({ sku: validItems[index].data.sku, error: 'Duplicate SKU or insert failed' });
                    }
                } else {
                    errors.push({ sku: validItems[index].data.sku, error: 'Database error' });
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
            'name', 'sku', 'slug', 'category', 'brand', 'series',
            'price', 'cost_price', 'stock_quantity', 'alert_threshold',
            'description', 'images', 'specifications', 'status'
        ];

        const updateData = {};
        const now = Date.now();

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // Handle JSON fields
                if (['images', 'specifications'].includes(key) && typeof value === 'object') {
                    updateData[key] = JSON.stringify(value);
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

        console.log('[ProductRepository.updateWithMeta] SQL:', `UPDATE products SET ${sets} WHERE id = ?`);
        console.log('[ProductRepository.updateWithMeta] Values:', JSON.stringify(values));

        try {
            const result = await this.db.prepare(`UPDATE products SET ${sets} WHERE id = ?`)
                .bind(...values)
                .run();

            console.log('[ProductRepository.updateWithMeta] D1 Result:', JSON.stringify(result));

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
     * 根据 SKU 查找
     * @param {string} sku 
     */
    async findBySku(sku) {
        const result = await this.db.prepare('SELECT * FROM products WHERE sku = ?').bind(sku).first();
        return this._parseResult(result);
    }

    /**
     * 根据条件搜索
     * @param {Object} filters { search, category, brand, status, page, limit }
     */
    async search(filters = {}) {
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (filters.status) {
            query += ' AND status = ?';
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
            query += ' AND (name LIKE ? OR sku LIKE ? OR series LIKE ?)';
            const term = `%${filters.search}%`;
            params.push(term, term, term);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(filters.limit, (filters.page - 1) * filters.limit);
        }

        const results = await this.db.prepare(query).bind(...params).all();

        // Count total for pagination
        // let countQuery = 'SELECT COUNT(*) as total FROM products WHERE 1=1';
        // Re-use logic for WHERE clause... (simplified here for brevity, ideally reuse builder)
        // For simplicity in this v1, just running a simple count if no complex filters, 
        // or we can just return the results.
        // Let's implement a proper simple count with same WHERE clauses
        const whereClause = query.substring(query.indexOf('WHERE'));
        // Strip ORDER BY and LIMIT
        const whereClauseClean = whereClause.split(' ORDER BY')[0];

        // We need to re-bind params excluding limit/offset
        const countParams = params.slice(0, params.length - (filters.limit ? 2 : 0));

        const countResult = await this.db.prepare(`SELECT COUNT(*) as total FROM products ${whereClauseClean}`)
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
                images: JSON.parse(item.images || '[]'),
                specifications: JSON.parse(item.specifications || '{}'),
            };
        } catch (e) {
            console.error('Error parsing product JSON:', e);
            return item;
        }
    }
}
