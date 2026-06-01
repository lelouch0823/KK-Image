import { chunkArray } from '../lib/db/batch.js';

const D1_CHUNK_SIZE = 100;

/**
 * 商品投影表 Repository
 * 预计算的变体聚合数据（价格、库存、活跃变体数），替代 _variantAggregateCTE() 全表扫描
 */
export class ProductProjectionRepository {
    constructor(db) {
        this.db = db;
    }

    /**
     * 查询单个商品的投影
     * @param {string} productId
     * @returns {Promise<Object|null>}
     */
    async findByProductId(productId) {
        const result = await this.db
            .prepare('SELECT * FROM product_projection WHERE product_id = ?')
            .bind(productId)
            .first();
        return result || null;
    }

    /**
     * 批量查询商品投影
     * @param {string[]} productIds
     * @returns {Promise<Map<string, Object>>}
     */
    async findByProductIds(productIds = []) {
        const ids = productIds.filter(Boolean);
        if (ids.length === 0) return new Map();

        const map = new Map();
        for (const chunk of chunkArray(ids, D1_CHUNK_SIZE)) {
            const placeholders = chunk.map(() => '?').join(',');
            const { results } = await this.db
                .prepare(`SELECT * FROM product_projection WHERE product_id IN (${placeholders})`)
                .bind(...chunk)
                .all();
            for (const row of results || []) {
                map.set(row.product_id, row);
            }
        }
        return map;
    }

    /**
     * 刷新单个商品的投影
     * @param {string} productId
     */
    async refreshByProductId(productId) {
        await this.refreshByProductIds([productId]);
    }

    /**
     * 批量刷新商品投影（chunked DELETE + INSERT）
     * @param {string[]} productIds
     */
    async refreshByProductIds(productIds = []) {
        const ids = [...new Set(productIds.filter(Boolean))];
        if (ids.length === 0) return;

        for (const chunk of chunkArray(ids, D1_CHUNK_SIZE)) {
            const placeholders = chunk.map(() => '?').join(',');
            await this.db.batch([
                this.db
                    .prepare(`DELETE FROM product_projection WHERE product_id IN (${placeholders})`)
                    .bind(...chunk),
                this.db
                    .prepare(`
                        INSERT INTO product_projection (
                            product_id, min_price, min_cost_price, total_stock, total_available,
                            min_alert_threshold, active_variant_count, updated_at
                        )
                        SELECT
                            pv.product_id,
                            MIN(CASE WHEN pv.status = 'active' THEN pv.price END) AS min_price,
                            MIN(CASE WHEN pv.status = 'active' THEN COALESCE(pv.cost_price, 0) END) AS min_cost_price,
                            SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.on_hand, pv.stock_quantity, 0) ELSE 0 END) AS total_stock,
                            SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.available, pv.stock_quantity, 0) ELSE 0 END) AS total_available,
                            MIN(CASE WHEN pv.status = 'active' THEN COALESCE(pv.alert_threshold, 10) END) AS min_alert_threshold,
                            SUM(CASE WHEN pv.status = 'active' THEN 1 ELSE 0 END) AS active_variant_count,
                            unixepoch() * 1000
                        FROM product_variants pv
                        LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
                        WHERE pv.product_id IN (${placeholders})
                        GROUP BY pv.product_id
                    `)
                    .bind(...chunk),
            ]);
        }
    }

    /**
     * 全量刷新（用于初始迁移或数据修复）
     */
    async refreshAll() {
        await this.db.exec('DELETE FROM product_projection');
        await this.db.exec(`
            INSERT INTO product_projection (
                product_id, min_price, min_cost_price, total_stock, total_available,
                min_alert_threshold, active_variant_count, updated_at
            )
            SELECT
                pv.product_id,
                MIN(CASE WHEN pv.status = 'active' THEN pv.price END) AS min_price,
                MIN(CASE WHEN pv.status = 'active' THEN COALESCE(pv.cost_price, 0) END) AS min_cost_price,
                SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.on_hand, pv.stock_quantity, 0) ELSE 0 END) AS total_stock,
                SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.available, pv.stock_quantity, 0) ELSE 0 END) AS total_available,
                MIN(CASE WHEN pv.status = 'active' THEN COALESCE(pv.alert_threshold, 10) END) AS min_alert_threshold,
                SUM(CASE WHEN pv.status = 'active' THEN 1 ELSE 0 END) AS active_variant_count,
                unixepoch() * 1000
            FROM product_variants pv
            LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
            GROUP BY pv.product_id
        `);
    }

    /**
     * 根据 variant_id 刷新关联的商品投影
     * @param {string[]} variantIds
     */
    async refreshByVariantIds(variantIds = []) {
        const ids = [...new Set(variantIds.filter(Boolean))];
        if (ids.length === 0) return;

        // 查找 variant 关联的 product_id
        const productIds = new Set();
        for (const chunk of chunkArray(ids, D1_CHUNK_SIZE)) {
            const placeholders = chunk.map(() => '?').join(',');
            const { results } = await this.db
                .prepare(`SELECT DISTINCT product_id FROM product_variants WHERE id IN (${placeholders})`)
                .bind(...chunk)
                .all();
            for (const row of results || []) {
                productIds.add(row.product_id);
            }
        }

        await this.refreshByProductIds([...productIds]);
    }
}
