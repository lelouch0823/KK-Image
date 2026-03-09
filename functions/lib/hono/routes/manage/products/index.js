import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { withCache } from '../../../middleware/cache.js';
import { requirePermission } from '../../../middleware/auth.js';
import { createManagedProduct } from './create-product.js';
import batch from './batch.js';
import exportRoute from './export.js';

const app = new Hono();
app.use('*', requirePermission('products:manage'));

app.route('/batch', batch);
app.route('/export', exportRoute);

const parseJsonSafe = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

/**
 * GET / - 搜索商品列表
 * SOTA: 使用边缘缓存 (TTL 60s) 减少 DB 压力
 */
app.get('/', withCache(60), async (c) => {
    const { env } = c;
    const { search, category, brand, status, page = 1, limit = 20 } = c.req.query();

    const repo = new ProductRepository(env.DB);
    const result = await repo.search({
        search,
        category,
        brand,
        status,
        page: parseInt(page),
        limit: parseInt(limit)
    });
    const items = (result.items || []).map((item) => ({
        ...item,
        primaryImage: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null,
    }));

    return c.json({
        success: true,
        data: items,
        meta: {
            total: result.total,
            page: parseInt(page),
            limit: parseInt(limit)
        }
    });
});

/**
 * GET /variants - active variant list for purchase-order picker
 */
app.get('/variants', withCache(30), async (c) => {
    const { env } = c;
    const { search = '', page = 1, limit = 50 } = c.req.query();

    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (normalizedPage - 1) * normalizedLimit;
    const keyword = String(search || '').trim();

    let where = 'WHERE pv.status = ?';
    const binds = ['active'];
    if (keyword) {
        where += `
          AND (
            p.name LIKE ? OR p.brand LIKE ? OR p.spu LIKE ? OR pv.sku LIKE ? OR pv.variant_code LIKE ?
          )
        `;
        const like = `%${keyword}%`;
        binds.push(like, like, like, like, like);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      ${where}
    `;

    const listSql = `
      SELECT
        pv.id AS variant_id,
        pv.product_id,
        p.name AS product_name,
        p.brand,
        p.spu,
        p.images AS product_images,
        pv.sku AS variant_sku,
        pv.variant_code,
        pv.options_values AS variant_options,
        pv.cost_price,
        pv.stock_quantity,
        pv.alert_threshold,
        pv.moq,
        pv.pack_size,
        pv.order_step,
        pv.image_id AS variant_image_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      ${where}
      ORDER BY p.updated_at DESC, p.created_at DESC, pv.created_at ASC
      LIMIT ? OFFSET ?
    `;

    const countResult = await env.DB.prepare(countSql).bind(...binds).all();
    const total = Number(countResult?.results?.[0]?.total || 0);

    const listResult = await env.DB.prepare(listSql).bind(...binds, normalizedLimit, offset).all();
    const items = (listResult?.results || []).map((row) => {
        const productImages = parseJsonSafe(row.product_images, []);
        const variantOptions = parseJsonSafe(row.variant_options, {});
        return {
            variant_id: row.variant_id,
            product_id: row.product_id,
            product_name: row.product_name,
            brand: row.brand || '',
            spu: row.spu || '',
            sku: row.variant_sku || '',
            variant_code: row.variant_code || null,
            variant_options: variantOptions,
            stock_quantity: Number(row.stock_quantity || 0),
            unit_cost: Number(row.cost_price || 0),
            moq: row.moq ?? null,
            pack_size: row.pack_size ?? null,
            order_step: row.order_step ?? null,
            image: row.variant_image_id || (Array.isArray(productImages) && productImages[0]) || null,
        };
    });

    return c.json({
        success: true,
        data: items,
        meta: {
            total,
            page: normalizedPage,
            limit: normalizedLimit,
        },
    });
});

/**
 * POST / - 创建商品
 */
app.post('/', async (c) => {
    const body = await c.req.json();
    const product = await createManagedProduct(c, body);
    return c.json({ success: true, data: product }, 201);
});

export default app;
