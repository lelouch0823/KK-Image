import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../../../../../repositories/VariantAuditRepository.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { requirePermission } from '../../../middleware/auth.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import { ProductCatalogService } from '../../../../../services/ProductCatalogService.js';

const app = new Hono();
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
    await ensureProductExists(productRepo, productId);

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
        scheduleProductCacheInvalidation(c, env.DB, { productIds: [id] });
        return c.json({ success: true, message: 'Product variants archived' });
    } else {
        throw new BadRequestError('Delete failed');
    }
});

export default app;
