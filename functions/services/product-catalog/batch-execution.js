import { normalizeVariantDimensionKeys, normalizeVariantExternalCodes } from '../../lib/hono/routes/manage/products/variant-normalizers.js';
import { BadRequestError } from '../../lib/hono/errors.js';
import { validateProductPayload } from '../../lib/hono/routes/manage/products/product-schema.js';
import {
    assertBatchItem,
    buildCatalogRollbackPayload,
    buildProductRollbackPayload,
    IMPORT_MODE,
    normalizeImportMode,
} from './batch-import.js';
import {
    buildSafeProductUpdateData,
    buildSafeVariantSyncPayload,
    mergeIncomingWithExisting,
} from './variant-matching.js';

export async function executeProductCatalogBatchImport({
    db,
    body = {},
    productRepo,
    variantRepo,
    dimensionRepo,
    syncDimensionsFromPayload,
}) {
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
                const existing = await productRepo.findBySpu(spu);
                if (existing) {
                    productId = existing.id;
                    existingProductSnapshot = typeof productRepo.findById === 'function'
                        ? await productRepo.findById(productId)
                        : existing;
                    existingDimensionsSnapshot = await dimensionRepo.listByProduct(productId);
                    productOperation = 'updated';
                    const updateData = { ...normalizedItem };
                    delete updateData.variants;
                    delete updateData.dimensions;
                    const nextUpdateData = importMode === IMPORT_MODE.SAFE_MERGE
                        ? buildSafeProductUpdateData(existingProductSnapshot || existing, updateData, conflicts)
                        : updateData;
                    if (Object.keys(nextUpdateData).length > 0) {
                        const updateResult = await productRepo.updateWithMeta(productId, nextUpdateData);
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
                const newProduct = await productRepo.create(createData);
                productId = newProduct.id;
                createdProductId = productId;
                isNew = true;
                productOperation = 'created';
            }

            if (normalizedItem.variants && normalizedItem.variants.length > 0) {
                const existingVariants = isNew ? [] : await variantRepo.findByProductId(productId);
                existingVariantsSnapshot = existingVariants;
                let normalizedVariants = normalizedItem.variants;
                if (Array.isArray(normalizedItem.dimensions) && normalizedItem.dimensions.length > 0) {
                    const dimensions = await syncDimensionsFromPayload(productId, normalizedItem.dimensions, {
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

                const syncResult = await variantRepo.syncVariants(productId, nextVariantsToSync);
                summary.createdVariants += syncResult?.createdCount ?? computedCreated;
                summary.updatedVariants += syncResult?.updatedCount ?? computedUpdated;
                summary.archivedVariants += syncResult?.archivedCount ?? syncResult?.deletedCount ?? 0;
                summary.reactivatedVariants += syncResult?.reactivatedCount ?? 0;
            }

            if (productOperation === 'created') {
                summary.createdProducts += 1;
            } else if (productOperation === 'updated') {
                summary.updatedProducts += 1;
            }
            if (productId) {
                updatedProductIds.add(productId);
            }
        } catch (error) {
            if (createdProductId) {
                try {
                    await db.prepare('DELETE FROM products WHERE id = ?').bind(createdProductId).run();
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
                            await productRepo.updateWithMeta(productId, rollbackProductData);
                        }
                    }
                    if (existingDimensionsSnapshot && typeof dimensionRepo.restoreSnapshot === 'function') {
                        await dimensionRepo.restoreSnapshot(productId, existingDimensionsSnapshot);
                    }
                    if (existingVariantsSnapshot) {
                        await variantRepo.syncVariants(productId, buildCatalogRollbackPayload(existingVariantsSnapshot));
                    }
                } catch (rollbackError) {
                    console.error('Batch product update rollback failed:', rollbackError);
                }
            }
            summary.failedProducts += 1;
            errors.push(`Failed to process item ${item.spu || item.name}: ${error.message}`);
        }
    }

    summary.conflicts = conflicts.length;
    const success = summary.createdProducts > 0 || summary.updatedProducts > 0;
    return {
        success,
        importMode,
        count: summary.createdProducts + summary.updatedProducts,
        summary,
        errors,
        conflicts: conflicts.slice(0, 200),
        productIds: [...updatedProductIds],
    };
}
