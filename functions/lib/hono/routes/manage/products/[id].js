import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';

const app = new Hono();

const isVariantOwnershipError = (error) =>
    error?.message?.includes('Variant does not belong to product');

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
    const variantImageRepo = new VariantImageRepository(env.DB);
    const variants = await variantRepo.findByProductId(id);
    product.variants = await Promise.all(
        variants.map(async (variant) => {
            const images = await variantImageRepo.listByVariant({
                productId: id,
                variantId: variant.id,
            });
            const primary = images.find((img) => Number(img.is_primary) === 1) || images[0] || null;
            return {
                ...variant,
                images,
                primaryImage: primary?.image_id || variant.image_id || null,
            };
        })
    );

    return c.json({ success: true, data: product });
});

app.post('/:id/variants/:variantId/images', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const body = await c.req.json();

    if (!body?.imageId) {
        throw new BadRequestError('imageId is required');
    }

    const productRepo = new ProductRepository(env.DB);
    const product = await productRepo.findById(productId);
    if (!product) {
        throw new NotFoundError('Product not found');
    }

    const variantImageRepo = new VariantImageRepository(env.DB);
    try {
        const created = await variantImageRepo.addImage({
            productId,
            variantId,
            imageId: body.imageId,
            isPrimary: Boolean(body.isPrimary),
        });
        return c.json({ success: true, data: created }, 201);
    } catch (error) {
        if (isVariantOwnershipError(error)) {
            throw new BadRequestError(error.message);
        }
        throw error;
    }
});

app.patch('/:id/variants/:variantId/images/sort', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const body = await c.req.json();

    if (!Array.isArray(body?.imageIds) || body.imageIds.length === 0) {
        throw new BadRequestError('imageIds must be a non-empty array');
    }

    const variantImageRepo = new VariantImageRepository(env.DB);
    try {
        await variantImageRepo.sortImages({
            productId,
            variantId,
            imageIds: body.imageIds,
        });
        return c.json({ success: true });
    } catch (error) {
        if (isVariantOwnershipError(error)) {
            throw new BadRequestError(error.message);
        }
        throw error;
    }
});

app.patch('/:id/variants/:variantId/images/:imageId/primary', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const imageId = c.req.param('imageId');

    const variantImageRepo = new VariantImageRepository(env.DB);
    try {
        await variantImageRepo.setPrimary({
            productId,
            variantId,
            imageId,
        });
        return c.json({ success: true });
    } catch (error) {
        if (isVariantOwnershipError(error)) {
            throw new BadRequestError(error.message);
        }
        throw error;
    }
});

app.delete('/:id/variants/:variantId/images/:imageId', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const imageId = c.req.param('imageId');

    const variantImageRepo = new VariantImageRepository(env.DB);
    try {
        const removed = await variantImageRepo.deleteImage({
            productId,
            variantId,
            imageId,
        });
        if (!removed) {
            throw new NotFoundError('Variant image not found');
        }
        return c.json({ success: true });
    } catch (error) {
        if (isVariantOwnershipError(error)) {
            throw new BadRequestError(error.message);
        }
        throw error;
    }
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
    
    let variantsUpdated = false;
    if (result.success && body.variants !== undefined) {
        const variantRepo = new ProductVariantRepository(env.DB);
        await variantRepo.syncVariants(id, body.variants);
        variantsUpdated = true;
    }

    // if product fields changed OR variants existed and successfully synced
    if ((result.success && result.changes > 0) || variantsUpdated) {
        // 使缓存失效
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
        return c.json({ success: true, message: 'Product updated', changes: result.changes });
    } else if (result.success && result.changes === 0) {
        throw new NotFoundError('No rows updated. Product may not exist or no changes.');
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
    
    if (success && body.variants !== undefined) {
        const variantRepo = new ProductVariantRepository(env.DB);
        await variantRepo.syncVariants(id, body.variants);
    }

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
