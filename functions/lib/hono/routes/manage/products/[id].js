import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../../../../../repositories/VariantAuditRepository.js';
import { resolveVariantImageSyncPlan } from './variant-image-sync.js';
import { archiveVariantImagesByFolder } from './variant-image-folders.js';
import { normalizeProductCurrency } from './currency.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { requirePermission } from '../../../middleware/auth.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';

const app = new Hono();
app.use('*', requirePermission('products:manage'));

const isVariantOwnershipError = (error) =>
    error?.message?.includes('Variant does not belong to product');
const isVariantSyncValidationError = (error) => {
    const message = String(error?.message || '');
    return (
        message.includes('duplicate variant signature in payload') ||
        message.includes('variant signature must be unique per product')
    );
};

const REQUIRED_VARIANT_FIELDS = ['price', 'cost_price', 'stock_quantity', 'alert_threshold', 'status'];
const PRODUCT_MUTABLE_FIELDS = new Set([
    'name', 'spu', 'slug', 'category', 'brand', 'series',
    'currency', 'description', 'images', 'specifications', 'options',
]);
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

const buildVariantRollbackPayload = (variants = []) =>
    (variants || []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: Number(variant.price) || 0,
        cost_price: variant.cost_price !== undefined && variant.cost_price !== null
            ? Number(variant.cost_price)
            : null,
        stock_quantity: Number(variant.stock_quantity) || 0,
        alert_threshold: Number(variant.alert_threshold) || 10,
        options_values: variant.options_values || {},
        image_id: variant.image_id || null,
        status: variant.status || 'active',
        barcode: variant.barcode ?? null,
        supplier_sku: variant.supplier_sku ?? null,
    }));

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

const hasOwnMeta = (value) =>
    value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'meta');

const normalizeMeta = (meta) => {
    if (meta === undefined || meta === null || meta === '') return null;
    return typeof meta === 'string' ? meta : JSON.stringify(meta);
};

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
        const existingValuesMap = new Map((current.values || []).map((item) => [item.value, item]));
        const incomingVals = (incoming.values || []).map(v => typeof v === 'string' ? { value: v } : v).filter(v => v.value);

        for (const item of incomingVals) {
            const valStr = String(item.value).trim();
            if (!valStr) continue;
            const shouldSyncMeta = hasOwnMeta(item);

            if (!existingValuesMap.has(valStr)) {
                const payload = { value: valStr };
                if (shouldSyncMeta) payload.meta = item.meta;
                const createdValue = await dimensionRepo.addValue(productId, dimension.id, payload);
                existingValuesMap.set(valStr, {
                    id: createdValue?.id,
                    value: valStr,
                    meta: shouldSyncMeta ? normalizeMeta(item.meta) : null,
                });
            } else {
                if (!shouldSyncMeta) continue;
                const existingRec = existingValuesMap.get(valStr);
                const newMetaStr = normalizeMeta(item.meta);
                const oldMetaStr = existingRec.meta || null;

                if (newMetaStr !== oldMetaStr && existingRec.id) {
                    await dimensionRepo.updateValueMeta(productId, dimension.id, existingRec.id, item.meta);
                    existingRec.meta = newMetaStr;
                }
            }
        }
    }

    return dimensionRepo.listByProduct(productId);
};

const loadVariantReplenishmentMap = async (db, variantIds = []) => {
    const normalizedIds = [...new Set((variantIds || []).filter(Boolean))];
    if (normalizedIds.length === 0) return new Map();

    const placeholders = normalizedIds.map(() => '?').join(',');
    const sql = `
      SELECT
        poi.variant_id,
        SUM(COALESCE(poi.quantity, 0)) AS replenishment_quantity,
        COUNT(DISTINCT poi.po_id) AS replenishment_po_count
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE poi.variant_id IN (${placeholders})
        AND po.status IN ('ordered', 'shipping')
      GROUP BY poi.variant_id
    `;
    const result = await db.prepare(sql).bind(...normalizedIds).all();
    const map = new Map();
    for (const row of result?.results || []) {
        map.set(row.variant_id, {
            replenishment_quantity: Number(row.replenishment_quantity || 0),
            replenishment_po_count: Number(row.replenishment_po_count || 0),
        });
    }
    return map;
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
    const replenishmentMap = await loadVariantReplenishmentMap(env.DB, variants.map((variant) => variant.id));
    const dimensions = await dimensionRepo.listByProduct(id);
    const dimensionMap = await dimensionRepo.getDimensionMap(id);
    product.variants = await Promise.all(
        variants.map(async (variant) => {
            const images = await variantImageRepo.listByVariant({
                productId: id,
                variantId: variant.id,
            });
            const primary = images.find((img) => Number(img.is_primary) === 1) || images[0] || null;
            const replenishment = replenishmentMap.get(variant.id) || {
                replenishment_quantity: 0,
                replenishment_po_count: 0,
            };
            return {
                ...variant,
                images,
                primaryImage: primary?.image_id || variant.image_id || null,
                replenishment_quantity: replenishment.replenishment_quantity,
                replenishment_po_count: replenishment.replenishment_po_count,
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [productId] });
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
    if (body.currency !== undefined) {
        const normalizedCurrency = normalizeProductCurrency(body.currency);
        if (!normalizedCurrency) throw new BadRequestError('Invalid currency code');
        body.currency = normalizedCurrency;
    }
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
    const hasProductFieldUpdates = Object.keys(body).some((key) => PRODUCT_MUTABLE_FIELDS.has(key));
    if (!hasProductFieldUpdates) {
        await ensureProductExists(repo, id);
    }
    const result = hasProductFieldUpdates
        ? await repo.updateWithMeta(id, body)
        : { success: true, changes: 0 };
    
    let variantsUpdated = false;
    let variantSync = null;
    if (result.success && body.variants !== undefined) {
        const variantRepo = new ProductVariantRepository(env.DB);
        const auditRepo = new VariantAuditRepository(env.DB);
        const beforeVariants = await variantRepo.findByProductId(id);
        let didSyncVariants = false;

        try {
            try {
                const syncResult = await variantRepo.syncVariants(id, body.variants);
                didSyncVariants = true;
                variantSync = {
                    created: syncResult?.createdCount ?? 0,
                    updated: syncResult?.updatedCount ?? 0,
                    archived: syncResult?.archivedCount ?? syncResult?.deletedCount ?? 0,
                    reactivated: syncResult?.reactivatedCount ?? 0,
                };
            } catch (error) {
                if (isVariantSyncValidationError(error)) {
                    throw new BadRequestError(error.message);
                }
                throw error;
            }

            const afterVariants = await variantRepo.findByProductId(id);
            const variantImageRepo = new VariantImageRepository(env.DB, variantRepo);
            const imageSyncPlan = resolveVariantImageSyncPlan({
                inputVariants: body.variants,
                persistedVariants: afterVariants,
            });
            if (imageSyncPlan.unresolved.length > 0) {
                throw new BadRequestError(
                    `Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`
                );
            }
            for (const task of imageSyncPlan.tasks) {
                await variantImageRepo.syncImages(id, task.variantId, task.images);
            }
            try {
                await archiveVariantImagesByFolder(env, id, imageSyncPlan.tasks);
            } catch (error) {
                console.error('Archive variant images by folder failed (product patch):', error);
            }

            const events = variantRepo.buildAuditEvents(id, beforeVariants, afterVariants);
            await auditRepo.createBatch(events);
            variantsUpdated = true;
        } catch (error) {
            if (didSyncVariants) {
                try {
                    await variantRepo.syncVariants(id, buildVariantRollbackPayload(beforeVariants));
                } catch (rollbackError) {
                    console.error('Variant rollback failed (product patch):', rollbackError);
                }
            }
            throw error;
        }
    }

    // if product fields changed OR variants existed and successfully synced
    if ((result.success && result.changes > 0) || variantsUpdated) {
        // 使缓存失效
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [id] });
        return c.json({
            success: true,
            message: 'Product updated',
            changes: result.changes,
            variantSync: variantSync || undefined,
        });
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
    if (body.currency !== undefined) {
        const normalizedCurrency = normalizeProductCurrency(body.currency);
        if (!normalizedCurrency) throw new BadRequestError('Invalid currency code');
        body.currency = normalizedCurrency;
    }
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
    let variantSync = null;
    
    if (success && body.variants !== undefined) {
        const variantRepo = new ProductVariantRepository(env.DB);
        const auditRepo = new VariantAuditRepository(env.DB);
        const beforeVariants = await variantRepo.findByProductId(id);
        let didSyncVariants = false;

        try {
            try {
                const syncResult = await variantRepo.syncVariants(id, body.variants);
                didSyncVariants = true;
                variantSync = {
                    created: syncResult?.createdCount ?? 0,
                    updated: syncResult?.updatedCount ?? 0,
                    archived: syncResult?.archivedCount ?? syncResult?.deletedCount ?? 0,
                    reactivated: syncResult?.reactivatedCount ?? 0,
                };
            } catch (error) {
                if (isVariantSyncValidationError(error)) {
                    throw new BadRequestError(error.message);
                }
                throw error;
            }

            const afterVariants = await variantRepo.findByProductId(id);
            const variantImageRepo = new VariantImageRepository(env.DB, variantRepo);
            const imageSyncPlan = resolveVariantImageSyncPlan({
                inputVariants: body.variants,
                persistedVariants: afterVariants,
            });
            if (imageSyncPlan.unresolved.length > 0) {
                throw new BadRequestError(
                    `Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`
                );
            }
            for (const task of imageSyncPlan.tasks) {
                await variantImageRepo.syncImages(id, task.variantId, task.images);
            }
            try {
                await archiveVariantImagesByFolder(env, id, imageSyncPlan.tasks);
            } catch (error) {
                console.error('Archive variant images by folder failed (product put):', error);
            }

            const events = variantRepo.buildAuditEvents(id, beforeVariants, afterVariants);
            await auditRepo.createBatch(events);
        } catch (error) {
            if (didSyncVariants) {
                try {
                    await variantRepo.syncVariants(id, buildVariantRollbackPayload(beforeVariants));
                } catch (rollbackError) {
                    console.error('Variant rollback failed (product put):', rollbackError);
                }
            }
            throw error;
        }
    }

    if (success) {
        // 使缓存失效
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [id] });
        return c.json({
            success: true,
            message: 'Product updated',
            variantSync: variantSync || undefined,
        });
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
    const changedRows = Number(result?.meta?.changes || 0);
    const hadVariants = Array.isArray(beforeVariants) && beforeVariants.length > 0;
    const success = changedRows > 0 || !hadVariants;

    if (success) {
        const events = (beforeVariants || []).map((variant) => ({
            variant_id: variant.id,
            product_id: id,
            action: 'variant_archived',
            changes: { before: { status: variant.status || 'active' }, after: { status: 'archived' } },
        }));
        if (events.length > 0) {
            await auditRepo.createBatch(events);
        }
        // 使缓存失效
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [id] });
        return c.json({ success: true, message: 'Product variants archived' });
    } else {
        throw new BadRequestError('Delete failed');
    }
});

export default app;
