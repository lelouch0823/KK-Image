import { generateId, now } from '../api/utils/id.js';

export class ProductVariantRepository {
    constructor(db) {
        this.db = db;
    }

    async createBatch(productId, variantsData) {
        if (!variantsData || variantsData.length === 0) return [];
        const timestamp = now();
        const statements = [];
        const results = [];

        for (const v of variantsData) {
            const id = v.id || generateId();
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, options_values, image_id, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id, productId, v.sku, Number(v.price) || 0, v.cost_price ? Number(v.cost_price) : null, Number(v.stock_quantity) || 0, 
                    JSON.stringify(v.options_values || {}), v.image_id || null, v.status || 'active', timestamp, timestamp
                )
            );
            results.push({ ...v, id, product_id: productId });
        }
        await this.db.batch(statements);
        return results;
    }

    async findByProductId(productId) {
        const results = await this.db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC').bind(productId).all();
        return (results.results || []).map(r => ({...r, options_values: JSON.parse(r.options_values || '{}')}));
    }
    
    async adjustStock(variantId, delta) {
        const timestamp = now();
        const result = await this.db.prepare(
            `UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?`
        ).bind(delta, timestamp, variantId).run();
        return result.meta?.changes > 0;
    }

    async syncVariants(productId, variantsData) {
        const timestamp = now();
        const statements = [];
        const incomingIds = variantsData.filter(v => v.id).map(v => v.id);

        // 1. Delete variants that are no longer present
        if (incomingIds.length > 0) {
            const placeholders = incomingIds.map(() => '?').join(',');
            statements.push(
                this.db.prepare(`DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (${placeholders})`)
                .bind(productId, ...incomingIds)
            );
        } else {
            // Delete all if no incoming variants are saved
            statements.push(
                this.db.prepare(`DELETE FROM product_variants WHERE product_id = ?`)
                .bind(productId)
            );
        }

        // 2. Upsert each incoming variant
        // SQLite UPSERT syntax: INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...
        const results = [];
        for (const v of variantsData) {
            const id = v.id || generateId();
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, options_values, image_id, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        sku = excluded.sku,
                        price = excluded.price,
                        cost_price = excluded.cost_price,
                        stock_quantity = excluded.stock_quantity,
                        options_values = excluded.options_values,
                        image_id = excluded.image_id,
                        status = excluded.status,
                        updated_at = excluded.updated_at`
                ).bind(
                    id, productId, v.sku, Number(v.price) || 0, v.cost_price ? Number(v.cost_price) : null, Number(v.stock_quantity) || 0, 
                    JSON.stringify(v.options_values || {}), v.image_id || null, v.status || 'active', timestamp, timestamp
                )
            );
            results.push({ ...v, id, product_id: productId });
        }
        await this.db.batch(statements);
        return results;
    }
}
