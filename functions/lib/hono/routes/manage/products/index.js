import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { withCache } from '../../../middleware/cache.js';

const app = new Hono();

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

    return c.json({
        success: true,
        data: result.items,
        meta: {
            total: result.total,
            page: parseInt(page),
            limit: parseInt(limit)
        }
    });
});

/**
 * POST / - 创建商品
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();

    if (!body.name || !body.sku) {
        return c.json({ success: false, error: 'Name and SKU are required' }, 400);
    }

    const repo = new ProductRepository(env.DB);

    // Check SKU uniqueness
    const existing = await repo.findBySku(body.sku);
    if (existing) {
        return c.json({ success: false, error: 'SKU already exists' }, 409);
    }

    try {
        const product = await repo.create(body);
        return c.json({ success: true, data: product }, 201);
    } catch (e) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

export default app;
