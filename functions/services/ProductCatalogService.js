import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../repositories/VariantAuditRepository.js';
import { resolveVariantImageSyncPlan } from '../lib/hono/routes/manage/products/variant-image-sync.js';
import { archiveVariantImagesByFolder } from '../lib/hono/routes/manage/products/variant-image-folders.js';
import { scheduleProductCacheInvalidation } from '../lib/hono/routes/manage/products/cache-helpers.js';
import { normalizeVariantDimensionKeys, normalizeVariantExternalCodes } from '../lib/hono/routes/manage/products/variant-normalizers.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/hono/errors.js';
import { validateProductPayload } from '../lib/hono/routes/manage/products/product-schema.js';
import {
    assertBatchItem,
    assignGeneratedSkuForPatchVariants,
    buildCatalogRollbackPayload,
    buildProductRollbackPayload,
    hasOwnMeta,
    hasVariantOptionSelections,
    IMPORT_MODE,
    normalizeImportMode,
    normalizeMeta,
    PRODUCT_MUTABLE_FIELDS,
} from "./product-catalog/batch-import.js";
import {
    buildSafeProductUpdateData,
    buildSafeVariantSyncPayload,
    mergeIncomingWithExisting,
} from "./product-catalog/variant-matching.js";
import {
    cleanupCreatedCatalogRecords,
    loadVariantImageSnapshot,
    rollbackPatchedProduct,
} from "./product-catalog/maintenance.js";

const isVariantSyncValidationError = (error) => {
    const message = String(error?.message || '');
    return (
        message.includes('duplicate variant signature in payload') ||
        message.includes('variant signature must be unique per product')
    );
};

export {
    assertBatchItem,
    normalizeImportMode,
} from "./product-catalog/batch-import.js";
export {
    buildVariantMatchKey,
    mergeIncomingWithExisting,
} from "./product-catalog/variant-matching.js";

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

    async syncDimensionsFromPayload(productId, incomingDimensions = [], { replaceMissing = false } = {}) {
        if (!Array.isArray(incomingDimensions)) {
            return this.dimensionRepo.listByProduct(productId);
        }

        const existing = await this.dimensionRepo.listByProduct(productId);
        const existingById = new Map(existing.map((item) => [item.id, item]));
        const syncedDimensionIds = new Set();

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
            syncedDimensionIds.add(dimension.id);

            const current = existingById.get(dimension.id) || { values: [] };
            const existingValuesMap = new Map((current.values || []).map((item) => [item.value, item]));
            const incomingVals = (incoming.values || [])
                .map((value) => (typeof value === 'string' ? { value } : value))
                .filter((value) => value.value);
            const incomingValueLabels = new Set();

            for (const item of incomingVals) {
                const valStr = String(item.value).trim();
                if (!valStr) continue;
                incomingValueLabels.add(valStr);
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

            if (replaceMissing) {
                for (const existingValue of current.values || []) {
                    const valueId = String(existingValue?.id || '').trim();
                    const valueLabel = String(existingValue?.value || '').trim();
                    if (!valueId || !valueLabel || existingValue?.status === 'archived') continue;
                    if (incomingValueLabels.has(valueLabel)) continue;
                    await this.dimensionRepo.archiveValue(productId, valueId);
                }
            }
        }

        if (replaceMissing) {
            for (const dimension of existing) {
                const dimensionId = String(dimension?.id || '').trim();
                if (!dimensionId || syncedDimensionIds.has(dimensionId) || dimension?.status === 'archived') continue;

                for (const value of dimension.values || []) {
                    const valueId = String(value?.id || '').trim();
                    if (!valueId || value?.status === 'archived') continue;
                    await this.dimensionRepo.archiveValue(productId, valueId);
                }

                await this.dimensionRepo.archiveDimension(productId, dimensionId);
            }
        }

        return this.dimensionRepo.listByProduct(productId);
    }

    async createProduct(c, body, options = {}) {
        const {
            skipCacheInvalidation = false,
            cacheEventCommandId,
            cacheEventCorrelationId,
        } = options;

        if (!body.name) {
            throw new BadRequestError('Name is required');
        }

        body = validateProductPayload(body, { requireVariants: true });

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
            await cleanupCreatedCatalogRecords({ db: this.db, created });
            throw error;
        }

        if (!skipCacheInvalidation) {
            await scheduleProductCacheInvalidation(c, {
                eventType: 'product_created',
                productIds: [product?.id || null],
            }, {
                commandId: cacheEventCommandId,
                correlationId: cacheEventCorrelationId,
            });
        }
        return product;
    }

    async patchProduct(c, productId, body, {
        fullReplace = false,
        skipCacheInvalidation = false,
        cacheEventCommandId,
        cacheEventCorrelationId,
    } = {}) {
        const existingProductSnapshot = await this.ensureProductExists(productId);

        const incomingDimensions = Array.isArray(body.dimensions) ? body.dimensions : null;
        const nextBody = { ...body };
        if (nextBody.dimensions !== undefined) delete nextBody.dimensions;

        Object.assign(nextBody, validateProductPayload(nextBody, {
            allowExistingVariantStockOmission: true,
            allowGeneratedVariantSku: true,
        }));

        let existingDimensionsForVariantSync = null;
        if (fullReplace && nextBody.variants !== undefined && !Array.isArray(body.dimensions)) {
            const hasIncomingDimensionedVariants = hasVariantOptionSelections(nextBody.variants);
            existingDimensionsForVariantSync = await this.dimensionRepo.listByProduct(productId);
            const hasExistingActiveDimensions = (existingDimensionsForVariantSync || []).some(
                (dimension) => dimension?.status !== 'archived'
            );

            if (hasIncomingDimensionedVariants || hasExistingActiveDimensions) {
                throw new BadRequestError(
                    'dimensions must be provided explicitly when replacing variants in full replace mode'
                );
            }
        }

        const hasProductFieldUpdates = Object.keys(nextBody).some((key) => PRODUCT_MUTABLE_FIELDS.has(key));
        const shouldRollbackDimensions = Boolean(incomingDimensions);
        const existingDimensionsSnapshot = shouldRollbackDimensions
            ? await this.dimensionRepo.listByProduct(productId)
            : null;

        let result = { success: true, changes: 0 };
        let beforeVariants = null;
        let beforeVariantImages = new Map();
        let afterVariants = null;
        let productUpdated = false;

        let variantsUpdated = false;
        let variantSync = null;
        let didSyncVariants = false;
        let dimensionsUpdated = false;
        let syncedDimensions = null;

        try {
            if (incomingDimensions) {
                syncedDimensions = await this.syncDimensionsFromPayload(productId, incomingDimensions, {
                    replaceMissing: fullReplace,
                });
                dimensionsUpdated = true;
            }

            if (nextBody.variants !== undefined) {
                beforeVariants = await this.variantRepo.findByProductId(productId);
                beforeVariantImages = await loadVariantImageSnapshot({
                    db: this.db,
                    productId,
                    variants: beforeVariants,
                    variantRepo: this.variantRepo,
                });

                const dimensions = syncedDimensions || existingDimensionsForVariantSync || await this.dimensionRepo.listByProduct(productId);
                nextBody.variants = normalizeVariantDimensionKeys(
                    assignGeneratedSkuForPatchVariants(
                        normalizeVariantExternalCodes(nextBody.variants),
                        this.variantRepo
                    ),
                    dimensions
                );
            }

            result = hasProductFieldUpdates
                ? await this.productRepo.updateWithMeta(productId, nextBody)
                : { success: true, changes: 0 };
            productUpdated = Boolean(hasProductFieldUpdates && result.success && result.changes > 0);

            if (result.success && nextBody.variants !== undefined) {
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

                afterVariants = await this.variantRepo.findByProductId(productId);
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
            }
        } catch (error) {
            if (productUpdated || shouldRollbackDimensions || didSyncVariants) {
                try {
                    await rollbackPatchedProduct({
                        db: this.db,
                        productRepo: this.productRepo,
                        dimensionRepo: this.dimensionRepo,
                        variantRepo: this.variantRepo,
                        productId,
                        existingProductSnapshot,
                        existingDimensionsSnapshot,
                        shouldRollbackProduct: productUpdated,
                        shouldRollbackDimensions,
                        didSyncVariants,
                        beforeVariants,
                        beforeVariantImages,
                        afterVariants,
                    });
                } catch (rollbackError) {
                    console.error('Patch rollback failed:', rollbackError);
                }
            }
            throw error;
        }

        if ((result.success && result.changes > 0) || variantsUpdated || dimensionsUpdated) {
            if (!skipCacheInvalidation) {
                await scheduleProductCacheInvalidation(c, {
                    eventType: fullReplace ? 'product_replaced' : 'product_updated',
                    productIds: [productId],
                }, {
                    commandId: cacheEventCommandId,
                    correlationId: cacheEventCorrelationId,
                });
            }
            return {
                changes: result.changes,
                variantSync: variantSync || undefined,
                variantsUpdated,
            };
        }

        if (result.success && result.changes === 0) {
            return {
                changes: 0,
                variantSync: variantSync || undefined,
                variantsUpdated: false,
            };
        }

        throw new BadRequestError(result.error || 'Update failed');
    }

    async putProduct(c, productId, body, options = {}) {
        return this.patchProduct(c, productId, body, { ...options, fullReplace: true });
    }

    async batchImport(c, body = {}, options = {}) {
        const {
            skipCacheInvalidation = false,
            cacheEventCommandId,
            cacheEventCorrelationId,
        } = options;
        const items = body.items;
        const importMode = normalizeImportMode(body.import_mode);

        if (!Array.isArray(items) || items.length === 0) {
            throw new BadRequestError('Invalid items array');
        }

        if (items.length > 500) {
            throw new BadRequestError('Batch size limit exceeded (max 500)');
        }

        const summary = {
            createdProducts: 0,
            updatedProducts: 0,
            createdVariants: 0,
            updatedVariants: 0,
            archivedVariants: 0,
            reactivatedVariants: 0,
            failedProducts: 0,
            conflicts: 0,
        };
        const errors = [];
        const conflicts = [];
        const updatedProductIds = new Set();

        for (const item of items) {
            let createdProductId = null;
            let productId = null;
            let productOperation = null;
            let existingProductSnapshot = null;
            let existingVariantsSnapshot = null;
            let existingDimensionsSnapshot = null;

            try {
                assertBatchItem(item);
                const normalizedItem = validateProductPayload({
                    ...item,
                    variants: normalizeVariantExternalCodes(item.variants),
                }, { requireVariants: true });
                const spu = normalizedItem.spu ? String(normalizedItem.spu).trim() : null;
                let isNew = false;

                if (spu) {
                    const existing = await this.productRepo.findBySpu(spu);
                    if (existing) {
                        productId = existing.id;
                        existingProductSnapshot = typeof this.productRepo.findById === 'function'
                            ? await this.productRepo.findById(productId)
                            : existing;
                        existingDimensionsSnapshot = await this.dimensionRepo.listByProduct(productId);
                        productOperation = 'updated';
                        const updateData = { ...normalizedItem };
                        delete updateData.variants;
                        delete updateData.dimensions;
                        const nextUpdateData = importMode === IMPORT_MODE.SAFE_MERGE
                            ? buildSafeProductUpdateData(existingProductSnapshot || existing, updateData, conflicts)
                            : updateData;
                        if (Object.keys(nextUpdateData).length > 0) {
                            const updateResult = await this.productRepo.updateWithMeta(productId, nextUpdateData);
                            if (updateResult?.success === false) {
                                throw new Error(updateResult.error || 'Update product failed');
                            }
                        }
                    }
                }

                if (!productId) {
                    const createData = { ...normalizedItem };
                    delete createData.variants;
                    delete createData.dimensions;
                    const newProduct = await this.productRepo.create(createData);
                    productId = newProduct.id;
                    createdProductId = productId;
                    isNew = true;
                    productOperation = 'created';
                }

                if (normalizedItem.variants && normalizedItem.variants.length > 0) {
                    const existingVariants = isNew ? [] : await this.variantRepo.findByProductId(productId);
                    existingVariantsSnapshot = existingVariants;
                    let normalizedVariants = normalizedItem.variants;
                    if (Array.isArray(normalizedItem.dimensions) && normalizedItem.dimensions.length > 0) {
                        const dimensions = await this.syncDimensionsFromPayload(productId, normalizedItem.dimensions, {
                            replaceMissing: importMode === IMPORT_MODE.REPLACE,
                        });
                        normalizedVariants = normalizeVariantDimensionKeys(normalizedVariants, dimensions);
                    }
                    const variantsToSync = mergeIncomingWithExisting(
                        existingVariants,
                        normalizedVariants,
                        { includeUnmatchedExisting: importMode !== IMPORT_MODE.REPLACE }
                    );
                    const nextVariantsToSync = importMode === IMPORT_MODE.SAFE_MERGE
                        ? buildSafeVariantSyncPayload(existingVariants, variantsToSync, conflicts, normalizedItem)
                        : variantsToSync;
                    const existingIdSet = new Set(existingVariants.map((variant) => variant.id));
                    const incomingVariantCount = Array.isArray(normalizedItem.variants) ? normalizedItem.variants.length : 0;
                    const matchedUpdateCount = nextVariantsToSync.reduce((count, variant) => (
                        variant?.id && existingIdSet.has(variant.id) ? count + 1 : count
                    ), 0);
                    const computedUpdated = Math.min(incomingVariantCount, matchedUpdateCount);
                    const computedCreated = Math.max(incomingVariantCount - computedUpdated, 0);

                    const syncResult = await this.variantRepo.syncVariants(productId, nextVariantsToSync);
                    summary.createdVariants += syncResult?.createdCount ?? computedCreated;
                    summary.updatedVariants += syncResult?.updatedCount ?? computedUpdated;
                    summary.archivedVariants += syncResult?.archivedCount ?? syncResult?.deletedCount ?? 0;
                    summary.reactivatedVariants += syncResult?.reactivatedCount ?? 0;
                }

                if (productOperation === 'created') {
                    summary.createdProducts++;
                } else if (productOperation === 'updated') {
                    summary.updatedProducts++;
                }
                if (productId) {
                    updatedProductIds.add(productId);
                }
            } catch (error) {
                if (createdProductId) {
                    try {
                        await this.db.prepare('DELETE FROM products WHERE id = ?').bind(createdProductId).run();
                    } catch (rollbackError) {
                        console.error('Batch product rollback failed:', rollbackError);
                    }
                    if (productOperation === 'created') {
                        summary.createdProducts = Math.max(0, summary.createdProducts - 1);
                    }
                    updatedProductIds.delete(createdProductId);
                } else if (productOperation === 'updated' && productId) {
                    try {
                        if (existingProductSnapshot) {
                            const rollbackProductData = buildProductRollbackPayload(existingProductSnapshot);
                            if (Object.keys(rollbackProductData).length > 0) {
                                await this.productRepo.updateWithMeta(productId, rollbackProductData);
                            }
                        }
                        if (existingDimensionsSnapshot && typeof this.dimensionRepo.restoreSnapshot === 'function') {
                            await this.dimensionRepo.restoreSnapshot(productId, existingDimensionsSnapshot);
                        }
                        if (existingVariantsSnapshot) {
                            await this.variantRepo.syncVariants(productId, buildCatalogRollbackPayload(existingVariantsSnapshot));
                        }
                    } catch (rollbackError) {
                        console.error('Batch product update rollback failed:', rollbackError);
                    }
                }
                summary.failedProducts++;
                errors.push(`Failed to process item ${item.spu || item.name}: ${error.message}`);
            }
        }

        summary.conflicts = conflicts.length;
        const success = summary.createdProducts > 0 || summary.updatedProducts > 0;
        const result = {
            success,
            importMode,
            count: summary.createdProducts + summary.updatedProducts,
            summary,
            errors,
            conflicts: conflicts.slice(0, 200),
            productIds: [...updatedProductIds],
        };

        if (success && !skipCacheInvalidation) {
            await scheduleProductCacheInvalidation(c, {
                eventType: 'product_batch_imported',
                productIds: [...updatedProductIds],
            }, {
                commandId: cacheEventCommandId,
                correlationId: cacheEventCorrelationId,
            });
        }

        return result;
    }
}
