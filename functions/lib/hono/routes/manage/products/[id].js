import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../../../../../repositories/VariantAuditRepository.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { requirePermission } from '../../../middleware/auth.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import { ProductCatalogService } from '../../../../../services/ProductCatalogService.js';
import { loadVariantReplenishmentMap } from '../../_shared/variant-replenishment.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/:id/dimensions', domain: 'products', action: 'product.dimension.create', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/dimensions/:dimensionId', domain: 'products', action: 'product.dimension.update', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/dimensions/:dimensionId/archive', domain: 'products', action: 'product.dimension.archive', severity: 'high', targetType: 'product' },
    { method: 'POST', path: '/:id/dimensions/:dimensionId/values', domain: 'products', action: 'product.dimension_value.create', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/values/:valueId/archive', domain: 'products', action: 'product.dimension_value.archive', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/values/:valueId/restore', domain: 'products', action: 'product.dimension_value.restore', severity: 'high', targetType: 'product' },
    { method: 'POST', path: '/:id/variants/:variantId/images', domain: 'products', action: 'product.variant_image.create', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/variants/:variantId/images/sort', domain: 'products', action: 'product.variant_image.sort', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/variants/:variantId/images/:imageId/primary', domain: 'products', action: 'product.variant_image.primary', severity: 'high', targetType: 'product' },
    { method: 'DELETE', path: '/:id/variants/:variantId/images/:imageId', domain: 'products', action: 'product.variant_image.delete', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id', domain: 'products', action: 'product.update', severity: 'high', targetType: 'product' },
    { method: 'PUT', path: '/:id', domain: 'products', action: 'product.replace', severity: 'high', targetType: 'product' },
    { method: 'DELETE', path: '/:id', domain: 'products', action: 'product.archive', severity: 'critical', targetType: 'product' },
]);
app.use('*', requirePermission('products:manage'));

const isVariantOwnershipError = (error) =>
    error?.message?.includes('Variant does not belong to product');

const ensureProductExists = async (productRepo, productId) => {
    const product = await productRepo.findById(productId);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    return product;
};

/**
 * GET /:id - 获取商品详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new ProductRepository(env.DB);
    const product = await ensureProductExists(repo, id);

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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_dimension_created', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.dimension.create',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Created dimension on product ${productId}`,
        });
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_dimension_updated', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.dimension.update',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Updated dimension ${dimensionId} on product ${productId}`,
        });
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_dimension_archived', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.dimension.archive',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Archived dimension ${dimensionId} on product ${productId}`,
        });
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_dimension_value_created', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.dimension_value.create',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Created dimension value on product ${productId}`,
        });
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_dimension_value_archived', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.dimension_value.archive',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Archived dimension value ${valueId} on product ${productId}`,
        });
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_dimension_value_restored', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.dimension_value.restore',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Restored dimension value ${valueId} on product ${productId}`,
        });
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
    await ensureProductExists(productRepo, productId);

    const variantImageRepo = new VariantImageRepository(env.DB);
    try {
        const created = await variantImageRepo.addImage({
            productId,
            variantId,
            imageId: body.imageId,
            isPrimary: Boolean(body.isPrimary),
        });
        await scheduleProductCacheInvalidation(c, { eventType: 'product_variant_image_created', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.variant_image.create',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Added variant image to product ${productId}`,
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_variant_image_sorted', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.variant_image.sort',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Sorted variant images on product ${productId}`,
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_variant_image_primary_changed', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.variant_image.primary',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Changed primary variant image on product ${productId}`,
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
        await scheduleProductCacheInvalidation(c, { eventType: 'product_variant_image_deleted', productIds: [productId] });
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.variant_image.delete',
            result: 'success',
            severity: 'high',
            targetType: 'product',
            targetId: productId,
            target_label: productId,
            summary: `Deleted variant image on product ${productId}`,
        });
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
    const id = c.req.param('id');
    const body = await c.req.json();
    const service = new ProductCatalogService(c.env.DB);
    const result = await service.patchProduct(c, id, body);
    scheduleAuditEvent(c, {
        domain: 'products',
        action: 'product.update',
        result: 'success',
        severity: 'high',
        targetType: 'product',
        targetId: id,
        target_label: id,
        summary: `Updated product ${id}`,
        metadata: { changeCount: Array.isArray(result?.changes) ? result.changes.length : undefined },
    });
    return c.json({
        success: true,
        message: 'Product updated',
        changes: result.changes,
        variantSync: result.variantSync,
    });
});

/**
 * PUT /:id - 更新商品 (Full Update)
 */
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const service = new ProductCatalogService(c.env.DB);
    const result = await service.putProduct(c, id, body);
    scheduleAuditEvent(c, {
        domain: 'products',
        action: 'product.replace',
        result: 'success',
        severity: 'high',
        targetType: 'product',
        targetId: id,
        target_label: id,
        summary: `Replaced product ${id}`,
        metadata: { changeCount: Array.isArray(result?.changes) ? result.changes.length : undefined },
    });
    return c.json({
        success: true,
        message: 'Product updated',
        changes: result.changes,
        variantSync: result.variantSync,
    });
});

/**
 * DELETE /:id - 删除商品 (Soft delete)
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new ProductRepository(env.DB);
    await ensureProductExists(repo, id);
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
        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.archive',
            result: 'success',
            severity: 'critical',
            targetType: 'product',
            targetId: id,
            target_label: id,
            summary: `Archived product ${id}`,
            metadata: { variantCount: events.length },
        });
        // 使缓存失效
        await scheduleProductCacheInvalidation(c, { eventType: 'product_archived', productIds: [id] });
        return c.json({ success: true, message: 'Product variants archived' });
    } else {
        throw new BadRequestError('Delete failed');
    }
});

export default app;
