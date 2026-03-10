import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../repositories/VariantAuditRepository.js';
import { resolveVariantImageSyncPlan } from '../lib/hono/routes/manage/products/variant-image-sync.js';
import { archiveVariantImagesByFolder } from '../lib/hono/routes/manage/products/variant-image-folders.js';
import { normalizeProductCurrency } from '../lib/hono/routes/manage/products/currency.js';
import { scheduleProductCacheInvalidation } from '../lib/hono/routes/manage/products/cache-helpers.js';
import { normalizeVariantDimensionKeys, normalizeVariantExternalCodes } from '../lib/hono/routes/manage/products/variant-normalizers.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/hono/errors.js';
import { validateProductPayload } from '../lib/hono/routes/manage/products/product-schema.js';
const PRODUCT_MUTABLE_FIELDS = new Set([
    'name', 'spu', 'slug', 'category', 'brand', 'series',
    'currency', 'description', 'images', 'specifications', 'options',
]);

const isVariantSyncValidationError = (error) => {
    const message = String(error?.message || '');
    return (
        message.includes('duplicate variant signature in payload') ||
        message.includes('variant signature must be unique per product')
    );
};

const hasOwnMeta = (value) =>
    value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'meta');

const normalizeMeta = (meta) => {
    if (meta === undefined || meta === null || meta === '') return null;
    return typeof meta === 'string' ? meta : JSON.stringify(meta);
};

function buildCatalogRollbackPayload(variants = []) {
    return (variants || []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: Number(variant.price) || 0,
        cost_price: variant.cost_price !== undefined && variant.cost_price !== null
            ? Number(variant.cost_price)
            : null,
        alert_threshold: Number(variant.alert_threshold) || 10,
        options_values: variant.options_values || {},
        image_id: variant.image_id || null,
        status: variant.status || 'active',
        barcode: variant.barcode ?? null,
        supplier_sku: variant.supplier_sku ?? null,
    }));
}

export class ProductCatalogService {
    constructor(db) {
        this.db = db;
        this.productRepo = new ProductRepository(db);
        this.variantRepo = new ProductVariantRepository(db);
        this.dimensionRepo = new ProductDimensionRepository(db);
        this.auditRepo = new VariantAuditRepository(db);
    }

    async ensureProductExists(productId) {
        const product = await this.productRepo.findById(productId);
        if (!product) {
            throw new NotFoundError('Product not found');
        }
        return product;
    }

    async syncDimensionsFromPayload(productId, incomingDimensions = []) {
        if (!Array.isArray(incomingDimensions)) {
            return this.dimensionRepo.listByProduct(productId);
        }

        const existing = await this.dimensionRepo.listByProduct(productId);
        const existingById = new Map(existing.map((item) => [item.id, item]));

        for (let index = 0; index < incomingDimensions.length; index++) {
            const incoming = incomingDimensions[index] || {};
            const name = String(incoming.name || '').trim();
            if (!name) continue;

            let dimension = null;
            const incomingId = String(incoming.id || '').trim();
            if (incomingId && existingById.has(incomingId)) {
                dimension = await this.dimensionRepo.updateDimension(productId, incomingId, {
                    name,
                    sort_order: index,
                });
            } else {
                dimension = await this.dimensionRepo.createDimension(productId, {
                    name,
                    sort_order: index,
                });
            }

            const current = existingById.get(dimension.id) || { values: [] };
            const existingValuesMap = new Map((current.values || []).map((item) => [item.value, item]));
            const incomingVals = (incoming.values || [])
                .map((value) => (typeof value === 'string' ? { value } : value))
                .filter((value) => value.value);

            for (const item of incomingVals) {
                const valStr = String(item.value).trim();
                if (!valStr) continue;
                const shouldSyncMeta = hasOwnMeta(item);

                if (!existingValuesMap.has(valStr)) {
                    const payload = { value: valStr };
                    if (shouldSyncMeta) payload.meta = item.meta;
                    const createdValue = await this.dimensionRepo.addValue(productId, dimension.id, payload);
                    existingValuesMap.set(valStr, {
                        id: createdValue?.id,
                        value: valStr,
                        meta: shouldSyncMeta ? normalizeMeta(item.meta) : null,
                    });
                } else if (shouldSyncMeta) {
                    const existingRec = existingValuesMap.get(valStr);
                    const newMetaStr = normalizeMeta(item.meta);
                    const oldMetaStr = existingRec.meta || null;

                    if (newMetaStr !== oldMetaStr && existingRec.id) {
                        await this.dimensionRepo.updateValueMeta(productId, dimension.id, existingRec.id, item.meta);
                        existingRec.meta = newMetaStr;
                    }
                }
            }
        }

        return this.dimensionRepo.listByProduct(productId);
    }

    async cleanupCreatedCatalogRecords(created) {
        for (const variantId of created.variantIds) {
            await this.db.prepare('DELETE FROM variant_images WHERE variant_id = ?').bind(variantId).run();
            await this.db.prepare('DELETE FROM product_variants WHERE id = ?').bind(variantId).run();
        }

        for (const valueId of created.dimensionValueIds) {
            await this.db.prepare('DELETE FROM product_dimension_values WHERE id = ?').bind(valueId).run();
        }

        for (const dimensionId of created.dimensionIds) {
            await this.db.prepare('DELETE FROM product_dimensions WHERE id = ?').bind(dimensionId).run();
        }

        if (created.productId) {
            await this.db.prepare('DELETE FROM products WHERE id = ?').bind(created.productId).run();
        }
    }

    async createProduct(c, body) {
        if (!body.name) {
            throw new BadRequestError('Name is required');
        }

        body = validateProductPayload(body, { requireVariants: true });
        body.currency = normalizeProductCurrency(body.currency);

        const normalizedSpu = typeof body.spu === 'string' ? body.spu.trim() : '';
        if (normalizedSpu) {
            body.spu = normalizedSpu;
            const existing = await this.productRepo.findBySpu(normalizedSpu);
            if (existing) {
                throw new ConflictError('SPU already exists');
            }
        }

        const created = {
            productId: null,
            dimensionIds: [],
            dimensionValueIds: [],
            variantIds: [],
        };

        let product = null;
        try {
            product = await this.productRepo.create(body);
            created.productId = product.id;

            const inputDimensions = Array.isArray(body.dimensions) ? body.dimensions : [];
            const createdDimensions = [];
            for (let i = 0; i < inputDimensions.length; i++) {
                const input = inputDimensions[i] || {};
                const dimension = await this.dimensionRepo.createDimension(product.id, {
                    name: input.name,
                    sort_order: Number.isInteger(input.sort_order) ? input.sort_order : i,
                });
                created.dimensionIds.push(dimension.id);
                createdDimensions.push(dimension);

                const values = Array.isArray(input.values) ? input.values : [];
                for (let j = 0; j < values.length; j++) {
                    const rawValue = values[j];
                    const value = typeof rawValue === 'string' ? rawValue : rawValue?.value;
                    if (!String(value || '').trim()) continue;

                    const payload = { value, sort_order: j };
                    if (rawValue && typeof rawValue === 'object' && Object.prototype.hasOwnProperty.call(rawValue, 'meta')) {
                        payload.meta = rawValue.meta;
                    }

                    const createdValue = await this.dimensionRepo.addValue(product.id, dimension.id, payload);
                    if (createdValue?.id) {
                        created.dimensionValueIds.push(createdValue.id);
                    }
                }
            }

            const normalizedVariants = normalizeVariantDimensionKeys(
                normalizeVariantExternalCodes(body.variants),
                createdDimensions
            );
            const createdVariants = await this.variantRepo.createBatch(product.id, normalizedVariants);
            created.variantIds.push(...createdVariants.map((variant) => variant.id).filter(Boolean));

            const variantImageRepo = new VariantImageRepository(this.db, this.variantRepo);
            const imageSyncPlan = resolveVariantImageSyncPlan({
                inputVariants: normalizedVariants,
                persistedVariants: createdVariants,
            });
            if (imageSyncPlan.unresolved.length > 0) {
                throw new BadRequestError(`Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`);
            }

            for (const task of imageSyncPlan.tasks) {
                await variantImageRepo.syncImages(product.id, task.variantId, task.images);
            }

            try {
                await archiveVariantImagesByFolder(c.env, product.id, imageSyncPlan.tasks);
            } catch (error) {
                console.error('Archive variant images by folder failed (product create):', error);
            }
        } catch (error) {
            await this.cleanupCreatedCatalogRecords(created);
            throw error;
        }

        scheduleProductCacheInvalidation(c, this.db, { productIds: [product?.id || null] });
        return product;
    }

    async patchProduct(c, productId, body) {
        const incomingDimensions = Array.isArray(body.dimensions) ? body.dimensions : null;
        const nextBody = { ...body };
        if (nextBody.dimensions !== undefined) delete nextBody.dimensions;

        if (nextBody.currency !== undefined) {
            nextBody.currency = normalizeProductCurrency(nextBody.currency);
        }

        if (nextBody.variants !== undefined) {
            const dimensions = incomingDimensions
                ? await this.syncDimensionsFromPayload(productId, incomingDimensions)
                : await this.dimensionRepo.listByProduct(productId);
            nextBody.variants = normalizeVariantDimensionKeys(
                normalizeVariantExternalCodes(nextBody.variants),
                dimensions
            );
        }

        Object.assign(nextBody, validateProductPayload(nextBody));

        const hasProductFieldUpdates = Object.keys(nextBody).some((key) => PRODUCT_MUTABLE_FIELDS.has(key));
        if (!hasProductFieldUpdates) {
            await this.ensureProductExists(productId);
        }

        const result = hasProductFieldUpdates
            ? await this.productRepo.updateWithMeta(productId, nextBody)
            : { success: true, changes: 0 };

        let variantsUpdated = false;
        let variantSync = null;
        if (result.success && nextBody.variants !== undefined) {
            const beforeVariants = await this.variantRepo.findByProductId(productId);
            let didSyncVariants = false;

            try {
                try {
                    const syncResult = await this.variantRepo.syncVariants(productId, nextBody.variants);
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

                const afterVariants = await this.variantRepo.findByProductId(productId);
                const variantImageRepo = new VariantImageRepository(this.db, this.variantRepo);
                const imageSyncPlan = resolveVariantImageSyncPlan({
                    inputVariants: nextBody.variants,
                    persistedVariants: afterVariants,
                });
                if (imageSyncPlan.unresolved.length > 0) {
                    throw new BadRequestError(
                        `Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`
                    );
                }

                for (const task of imageSyncPlan.tasks) {
                    await variantImageRepo.syncImages(productId, task.variantId, task.images);
                }

                try {
                    await archiveVariantImagesByFolder(c.env, productId, imageSyncPlan.tasks);
                } catch (error) {
                    console.error('Archive variant images by folder failed (product patch):', error);
                }

                const events = this.variantRepo.buildAuditEvents(productId, beforeVariants, afterVariants);
                await this.auditRepo.createBatch(events);
                variantsUpdated = true;
            } catch (error) {
                if (didSyncVariants) {
                    try {
                        await this.variantRepo.syncVariants(productId, buildCatalogRollbackPayload(beforeVariants));
                    } catch (rollbackError) {
                        console.error('Variant rollback failed (product patch):', rollbackError);
                    }
                }
                throw error;
            }
        }

        if ((result.success && result.changes > 0) || variantsUpdated) {
            scheduleProductCacheInvalidation(c, this.db, { productIds: [productId] });
            return {
                changes: result.changes,
                variantSync: variantSync || undefined,
                variantsUpdated,
            };
        }

        if (result.success && result.changes === 0) {
            throw new NotFoundError('No rows updated. Product may not exist or no changes.');
        }

        throw new BadRequestError(result.error || 'Update failed');
    }

    async putProduct(c, productId, body) {
        return this.patchProduct(c, productId, body);
    }
}
