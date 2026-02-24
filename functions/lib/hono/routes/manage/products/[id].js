import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { invalidateCache } from '../../../middleware/cache.js';

const app = new Hono();

/**
 * 构建缓存失效 URL
 */
const getProductCacheUrls = (c) => {
    const origin = new URL(c.req.url).origin;
    return [
        `${origin}/api/manage/products`,
        `${origin}/api/manage/products?page=1&limit=20`,
    ];
};

/**
 * GET /:id - 获取商品详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');
        const repo = new ProductRepository(env.DB);
        const product = await repo.findById(id);

        if (!product) {
            return c.json({ success: false, error: 'Product not found' }, 404);
        }

        return c.json({ success: true, data: product });
    } catch (err) {
        console.error('[Products/:id] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * PATCH /:id - 更新商品 (Partial Update)
 */
app.patch('/:id', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const repo = new ProductRepository(env.DB);

        const result = await repo.updateWithMeta(id, body);

        if (result.success && result.changes > 0) {
            // 使缓存失效
            c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
            return c.json({ success: true, message: 'Product updated', changes: result.changes });
        } else if (result.success && result.changes === 0) {
            return c.json({ success: false, error: 'No rows updated. Product may not exist.' }, 404);
        } else {
            return c.json({ success: false, error: result.error || 'Update failed' }, 400);
        }
    } catch (err) {
        console.error('[Products/:id] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * PUT /:id - 更新商品 (Full Update)
 */
app.put('/:id', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const repo = new ProductRepository(env.DB);

        const success = await repo.update(id, body);

        if (success) {
            // 使缓存失效
            c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
            return c.json({ success: true, message: 'Product updated' });
        } else {
            return c.json({ success: false, error: 'Update failed or no changes' }, 400);
        }
    } catch (err) {
        console.error('[Products/:id] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * DELETE /:id - 删除商品 (Soft delete)
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');
        const repo = new ProductRepository(env.DB);

        const success = await repo.update(id, { status: 'archived' });

        if (success) {
            // 使缓存失效
            c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
            return c.json({ success: true, message: 'Product archived' });
        } else {
            return c.json({ success: false, error: 'Delete failed' }, 400);
        }
    } catch (err) {
        console.error('[Products/:id] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default app;
