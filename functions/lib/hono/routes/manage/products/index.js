import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { withCache, invalidateCache } from '../../../middleware/cache.js';
import { BadRequestError, ConflictError } from '../../../errors.js';

const getProductCacheUrls = (c) => {
    const origin = new URL(c.req.url).origin;
    return [
        `${origin}/api/manage/products`,
        `${origin}/api/manage/products?page=1&limit=20`,
    ];
};
import batch from './batch.js';
import exportRoute from './export.js';

const app = new Hono();

app.route('/batch', batch);
app.route('/export', exportRoute);

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
        throw new BadRequestError('Name and SKU are required');
    }

    const repo = new ProductRepository(env.DB);

    // Check SKU uniqueness
    const existing = await repo.findBySku(body.sku);
    if (existing) {
        throw new ConflictError('SKU already exists');
    }

    const product = await repo.create(body);

    c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));

    return c.json({ success: true, data: product }, 201);
});

export default app;
