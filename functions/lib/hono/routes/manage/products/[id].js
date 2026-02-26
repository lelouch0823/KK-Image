import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../../../../../repositories/VariantAuditRepository.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';

const app = new Hono();

const isVariantOwnershipError = (error) =>
    error?.message?.includes('Variant does not belong to product');

const REQUIRED_VARIANT_FIELDS = ['price', 'cost_price', 'stock_quantity', 'alert_threshold', 'status'];
const isEmptyValue = (value) => value === undefined || value === null || value === '';

const validateVariants = (variants) => {
    if (!Array.isArray(variants) || variants.length === 0) {
        throw new BadRequestError('At least one variant is required');
    }
    for (const [index, variant] of variants.entries()) {
        if (!variant || typeof variant !== 'object') {
            throw new BadRequestError(`Variant #${index + 1} is invalid`);
        }
        for (const field of REQUIRED_VARIANT_FIELDS) {
            if (isEmptyValue(variant[field])) {
                throw new BadRequestError(`Variant #${index + 1} missing required field: ${field}`);
            }
        }
    }
};

const normalizeVariantExternalCodes = (variants = []) => variants.map((variant) => ({
    ...variant,
    barcode: String(variant?.barcode ?? '').trim() || null,
    supplier_sku: String(variant?.supplier_sku ?? '').trim() || null,
}));

const buildDimensionNameMap = (dimensions = []) =>
    (dimensions || []).reduce((acc, item) => {
        const name = String(item?.name || '').trim();
        const id = String(item?.id || '').trim();
        if (name && id) acc[name] = id;
        return acc;
    }, {});

const normalizeVariantDimensionKeys = (variants = [], dimensions = []) => {
    const nameMap = buildDimensionNameMap(dimensions);
    return (variants || []).map((variant) => {
        const normalized = {};
        for (const [key, value] of Object.entries(variant?.options_values || {})) {
            const rawKey = String(key || '').trim();
            const nextKey = nameMap[rawKey] || rawKey;
            if (!nextKey) continue;
            if (value === undefined || value === null || String(value).trim() === '') continue;
            normalized[nextKey] = String(value);
        }
        return {
            ...variant,
            options_values: normalized,
        };
    });
};

const ensureProductExists = async (productRepo, productId) => {
    const product = await productRepo.findById(productId);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    return product;
};

const normalizeDimensionValues = (values = []) =>
    (values || [])
        .map((entry) => (typeof entry === 'string' ? entry : entry?.value))
        .map((value) => String(value || '').trim())
        .filter(Boolean);

const syncDimensionsFromPayload = async (dimensionRepo, productId, incomingDimensions = []) => {
    if (!Array.isArray(incomingDimensions)) {
        return dimensionRepo.listByProduct(productId);
    }

    const existing = await dimensionRepo.listByProduct(productId);
    const existingById = new Map(existing.map((item) => [item.id, item]));

    for (let index = 0; index < incomingDimensions.length; index++) {
        const incoming = incomingDimensions[index] || {};
        const name = String(incoming.name || '').trim();
        if (!name) continue;

        let dimension = null;
        const incomingId = String(incoming.id || '').trim();
        if (incomingId && existingById.has(incomingId)) {
            dimension = await dimensionRepo.updateDimension(productId, incomingId, {
                name,
                sort_order: index,
            });
        } else {
            dimension = await dimensionRepo.createDimension(productId, {
                name,
                sort_order: index,
            });
        }

        const current = existingById.get(dimension.id) || { values: [] };
        const existingValues = new Set((current.values || []).map((item) => item.value));
        const normalizedValues = normalizeDimensionValues(incoming.values);
        for (const value of normalizedValues) {
            if (existingValues.has(value)) continue;
            await dimensionRepo.addValue(productId, dimension.id, { value });
            existingValues.add(value);
        }
    }

    return dimensionRepo.listByProduct(productId);
};

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
    const dimensionRepo = new ProductDimensionRepository(env.DB);
    const variantImageRepo = new VariantImageRepository(env.DB);
    const variants = await variantRepo.findByProductId(id);
    const dimensions = await dimensionRepo.listByProduct(id);
    const dimensionMap = await dimensionRepo.getDimensionMap(id);
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
    product.dimensions = dimensions;
    product.dimension_map = dimensionMap;

    return c.json({ success: true, data: product });
});

app.post('/:id/dimensions', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const created = await dimensionRepo.createDimension(productId, body);
        return c.json({ success: true, data: created }, 201);
    } catch (error) {
        throw new BadRequestError(error.message || 'Create dimension failed');
    }
});

app.patch('/:id/dimensions/:dimensionId', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = await c.req.json();
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const updated = await dimensionRepo.updateDimension(productId, dimensionId, body);
        return c.json({ success: true, data: updated });
    } catch (error) {
        throw new BadRequestError(error.message || 'Update dimension failed');
    }
});

app.patch('/:id/dimensions/:dimensionId/archive', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = await c.req.json().catch(() => ({}));
    const mode = String(body?.mode || 'archive_variants').trim();

    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        let effect = null;
        if (mode === 'merge_keep') {
            effect = await dimensionRepo.mergeKeepByDimensionRemoval(productId, dimensionId);
        } else {
            effect = { archivedVariants: await dimensionRepo.archiveVariantsByDimension(productId, dimensionId) };
        }
        const archivedDimension = await dimensionRepo.archiveDimension(productId, dimensionId);
        return c.json({ success: true, data: { dimension: archivedDimension, effect } });
    } catch (error) {
        throw new BadRequestError(error.message || 'Archive dimension failed');
    }
});

app.post('/:id/dimensions/:dimensionId/values', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = await c.req.json();
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const created = await dimensionRepo.addValue(productId, dimensionId, body);
        return c.json({ success: true, data: created }, 201);
    } catch (error) {
        throw new BadRequestError(error.message || 'Add value failed');
    }
});

app.patch('/:id/values/:valueId/archive', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const valueId = c.req.param('valueId');
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const effect = await dimensionRepo.archiveVariantsByValue(productId, valueId);
        const value = await dimensionRepo.archiveValue(productId, valueId);
        return c.json({ success: true, data: { value, effect } });
    } catch (error) {
        throw new BadRequestError(error.message || 'Archive value failed');
    }
});

app.patch('/:id/values/:valueId/restore', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const valueId = c.req.param('valueId');
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const value = await dimensionRepo.restoreValue(productId, valueId);
        return c.json({ success: true, data: value });
    } catch (error) {
        throw new BadRequestError(error.message || 'Restore value failed');
    }
});

app.post('/:id/dimensions/impact', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const result = await dimensionRepo.getImpactPreview(productId, body);
        return c.json({ success: true, data: result });
    } catch (error) {
        throw new BadRequestError(error.message || 'Impact preview failed');
    }
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
    const incomingDimensions = Array.isArray(body.dimensions) ? body.dimensions : null;
    if (body.dimensions !== undefined) delete body.dimensions;
    if (body.variants !== undefined) {
        const dimensionRepo = new ProductDimensionRepository(env.DB);
        const dimensions = incomingDimensions
            ? await syncDimensionsFromPayload(dimensionRepo, id, incomingDimensions)
            : await dimensionRepo.listByProduct(id);
        body.variants = normalizeVariantDimensionKeys(
            normalizeVariantExternalCodes(body.variants),
            dimensions
        );
    }
    const repo = new ProductRepository(env.DB);
    if (body.variants !== undefined) {
        validateVariants(body.variants);
    }

    const result = await repo.updateWithMeta(id, body);
    
    let variantsUpdated = false;
    if (result.success && body.variants !== undefined) {
        const variantRepo = new ProductVariantRepository(env.DB);
        const auditRepo = new VariantAuditRepository(env.DB);
        const beforeVariants = await variantRepo.findByProductId(id);
        await variantRepo.syncVariants(id, body.variants);
        const afterVariants = await variantRepo.findByProductId(id);
        const events = variantRepo.buildAuditEvents(id, beforeVariants, afterVariants);
        await auditRepo.createBatch(events);
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
    const incomingDimensions = Array.isArray(body.dimensions) ? body.dimensions : null;
    if (body.dimensions !== undefined) delete body.dimensions;
    if (body.variants !== undefined) {
        const dimensionRepo = new ProductDimensionRepository(env.DB);
        const dimensions = incomingDimensions
            ? await syncDimensionsFromPayload(dimensionRepo, id, incomingDimensions)
            : await dimensionRepo.listByProduct(id);
        body.variants = normalizeVariantDimensionKeys(
            normalizeVariantExternalCodes(body.variants),
            dimensions
        );
    }
    const repo = new ProductRepository(env.DB);
    if (body.variants !== undefined) {
        validateVariants(body.variants);
    }

    const success = await repo.update(id, body);
    
    if (success && body.variants !== undefined) {
        const variantRepo = new ProductVariantRepository(env.DB);
        const auditRepo = new VariantAuditRepository(env.DB);
        const beforeVariants = await variantRepo.findByProductId(id);
        await variantRepo.syncVariants(id, body.variants);
        const afterVariants = await variantRepo.findByProductId(id);
        const events = variantRepo.buildAuditEvents(id, beforeVariants, afterVariants);
        await auditRepo.createBatch(events);
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
    const product = await repo.findById(id);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    const now = Date.now();
    const variantRepo = new ProductVariantRepository(env.DB);
    const auditRepo = new VariantAuditRepository(env.DB);
    const beforeVariants = await variantRepo.findByProductId(id);
    const result = await env.DB
        .prepare(`UPDATE product_variants SET status = 'archived', updated_at = ? WHERE product_id = ?`)
        .bind(now, id)
        .run();
    const success = (result.meta?.changes || 0) >= 0;

    if (success) {
        const events = (beforeVariants || []).map((variant) => ({
            variant_id: variant.id,
            product_id: id,
            action: 'variant_archived',
            changes: { before: { status: variant.status || 'active' }, after: { status: 'archived' } },
        }));
        await auditRepo.createBatch(events);
        // 使缓存失效
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
        return c.json({ success: true, message: 'Product variants archived' });
    } else {
        throw new BadRequestError('Delete failed');
    }
});

export default app;
