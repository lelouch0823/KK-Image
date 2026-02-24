import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { invalidateCache, getProductCacheUrls } from '../../../middleware/cache.js';
import { BadRequestError } from '../../../errors.js';

const app = new Hono();

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('Invalid items array');
    }

    // 限制批量大小以防止超时
    if (items.length > 500) {
        throw new BadRequestError('Batch size limit exceeded (max 500)');
    }

    const repo = new ProductRepository(env.DB);
    const result = await repo.createBatch(items);

    // 缓存失效
    if (result.success && result.count > 0) {
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
    }

    return c.json(result);
});

export default app;
