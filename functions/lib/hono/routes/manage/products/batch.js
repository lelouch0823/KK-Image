import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { invalidateCache, getProductCacheUrls } from '../../../middleware/cache.js';

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
        return c.json({ success: false, error: 'Invalid items array' }, 400);
    }

    // Limit batch size to prevent timeouts
    if (items.length > 500) {
        return c.json({ success: false, error: 'Batch size limit exceeded (max 500)' }, 400);
    }

    const repo = new ProductRepository(env.DB);

    try {
        const result = await repo.createBatch(items);

        // Cache Invalidation
        if (result.success && result.count > 0) {
            c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
        }

        return c.json(result);
    } catch (e) {
        console.error('Batch import error:', e);
        return c.json({ success: false, error: e.message }, 500);
    }
});

export default app;
