import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';

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
    const id = c.req.param('id');
    const repo = new ProductRepository(env.DB);
    const product = await repo.findById(id);

    if (!product) {
        throw new NotFoundError('Product not found');
    }

    const variantRepo = new ProductVariantRepository(env.DB);
    product.variants = await variantRepo.findByProductId(id);

    return c.json({ success: true, data: product });
});

/**
 * PATCH /:id - 更新商品 (Partial Update)
 */
app.patch('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = await c.req.json();
    const repo = new ProductRepository(env.DB);

    const result = await repo.updateWithMeta(id, body);

    if (result.success && result.changes > 0) {
        // 使缓存失效
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
        return c.json({ success: true, message: 'Product updated', changes: result.changes });
    } else if (result.success && result.changes === 0) {
        throw new NotFoundError('No rows updated. Product may not exist.');
    } else {
        throw new BadRequestError(result.error || 'Update failed');
    }
});

/**
 * PUT /:id - 更新商品 (Full Update)
 */
app.put('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = await c.req.json();
    const repo = new ProductRepository(env.DB);

    const success = await repo.update(id, body);

    if (success) {
        // 使缓存失效
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
        return c.json({ success: true, message: 'Product updated' });
    } else {
        throw new BadRequestError('Update failed or no changes');
    }
});

/**
 * DELETE /:id - 删除商品 (Soft delete)
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new ProductRepository(env.DB);

    const success = await repo.update(id, { status: 'archived' });

    if (success) {
        // 使缓存失效
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
        return c.json({ success: true, message: 'Product archived' });
    } else {
        throw new BadRequestError('Delete failed');
    }
});

export default app;
