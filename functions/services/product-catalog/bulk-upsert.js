import { normalizeVariantDimensionKeys } from '../../lib/hono/routes/manage/products/variant-normalizers.js';
import {
    buildCatalogRollbackPayload,
    buildProductRollbackPayload,
    IMPORT_MODE,
} from './batch-import.js';
import {
    buildSafeVariantSyncPayload,
    mergeIncomingWithExisting,
} from './variant-matching.js';

const formatImportItemName = (plan) => String(plan?.normalizedItem?.spu || plan?.normalizedItem?.name || 'UNKNOWN');

const normalizeStats = (stats = {}, fallback = {}) => ({
    createdCount: stats?.createdCount ?? fallback.createdCount ?? 0,
    updatedCount: stats?.updatedCount ?? fallback.updatedCount ?? 0,
    archivedCount: stats?.archivedCount ?? stats?.deletedCount ?? fallback.archivedCount ?? 0,
    reactivatedCount: stats?.reactivatedCount ?? fallback.reactivatedCount ?? 0,
});

async function rollbackFailedImportPlan({
    db,
    plan,
    productRepo,
    variantRepo,
    dimensionRepo,
}) {
    if (!plan) return;

    if (plan.operation === 'created') {
        await db.prepare('DELETE FROM products WHERE id = ?').bind(plan.productId).run();
        return;
    }

    if (plan.operation !== 'updated') return;

    if (plan.existingProductSnapshot && typeof productRepo?.updateWithMeta === 'function') {
        const rollbackProductData = buildProductRollbackPayload(plan.existingProductSnapshot);
        if (Object.keys(rollbackProductData).length > 0) {
            await productRepo.updateWithMeta(plan.productId, rollbackProductData);
        }
    }

    if (plan.existingDimensionsSnapshot && typeof dimensionRepo?.restoreSnapshot === 'function') {
        await dimensionRepo.restoreSnapshot(plan.productId, plan.existingDimensionsSnapshot);
    }

    if (plan.existingVariantsSnapshot && typeof variantRepo?.syncVariants === 'function') {
        await variantRepo.syncVariants(plan.productId, buildCatalogRollbackPayload(plan.existingVariantsSnapshot));
    }
}

async function buildVariantSyncPlan({
    plan,
    importMode,
    conflicts,
    syncDimensionsFromPayload,
}) {
    const normalizedItem = plan.normalizedItem;
    let normalizedVariants = normalizedItem.variants;

    if (Array.isArray(normalizedItem.dimensions) && normalizedItem.dimensions.length > 0) {
        const dimensions = await syncDimensionsFromPayload(plan.productId, normalizedItem.dimensions, {
            replaceMissing: importMode === IMPORT_MODE.REPLACE,
        });
        normalizedVariants = normalizeVariantDimensionKeys(normalizedVariants, dimensions);
    }

    const existingVariants = plan.operation === 'created'
        ? []
        : (plan.existingVariantsSnapshot || []);
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

    return {
        itemKey: plan.itemKey,
        productId: plan.productId,
        variantsToSync: nextVariantsToSync,
        existingVariants: existingVariants,
        fallbackStats: {
            createdCount: computedCreated,
            updatedCount: computedUpdated,
            archivedCount: 0,
            reactivatedCount: 0,
        },
    };
}

export async function executeBulkProductImportUpsert({
    db,
    plans = [],
    importMode,
    productRepo,
    variantRepo,
    dimensionRepo,
    syncDimensionsFromPayload,
    summary,
    errors,
    conflicts,
    updatedProductIds,
}) {
    if (!Array.isArray(plans) || plans.length === 0) {
        return;
    }

    const productResult = await productRepo.bulkUpsertFromImport(plans.map((plan) => ({
        itemKey: plan.itemKey,
        operation: plan.operation,
        productId: plan.productId,
        productData: plan.productData,
        existingSnapshot: plan.existingProductSnapshot || null,
        needsProductUpsert: plan.needsProductUpsert !== false,
    })));

    const planByKey = new Map(plans.map((plan) => [plan.itemKey, plan]));
    const failedProductKeys = new Set();
    for (const success of productResult?.successes || []) {
        const plan = planByKey.get(success.itemKey);
        if (!plan) continue;
        const resolvedProductId = String(success.productId || '').trim();
        if (resolvedProductId && resolvedProductId !== plan.productId) {
            updatedProductIds.delete(plan.productId);
            plan.productId = resolvedProductId;
            updatedProductIds.add(resolvedProductId);
        }
    }
    for (const failure of productResult?.failures || []) {
        const plan = planByKey.get(failure.itemKey);
        if (!plan) continue;
        failedProductKeys.add(plan.itemKey);
        summary.failedProducts += 1;
        updatedProductIds.delete(plan.productId);
        const itemLabel = formatImportItemName(plan);
        errors.push(`Failed to process item ${itemLabel}: ${failure.error?.message || 'Product upsert failed'}`);
    }

    const productSuccessPlans = plans.filter((plan) => !failedProductKeys.has(plan.itemKey));
    if (productSuccessPlans.length === 0) return;

    const variantPlans = [];
    for (const plan of productSuccessPlans) {
        try {
            const variantPlan = await buildVariantSyncPlan({
                plan,
                importMode,
                conflicts,
                syncDimensionsFromPayload,
            });
            variantPlans.push(variantPlan);
        } catch (error) {
            try {
                await rollbackFailedImportPlan({ db, plan, productRepo, variantRepo, dimensionRepo });
            } catch (rollbackError) {
                console.error('Batch product update rollback failed:', rollbackError);
            }
            summary.failedProducts += 1;
            updatedProductIds.delete(plan.productId);
            const itemLabel = formatImportItemName(plan);
            errors.push(`Failed to process item ${itemLabel}: ${error.message}`);
        }
    }

    if (variantPlans.length === 0) return;

    const variantResult = await variantRepo.bulkSyncFromImport(variantPlans);
    const successfulVariantMap = new Map((variantResult?.successes || []).map((entry) => [entry.itemKey, entry]));
    const failedVariantMap = new Map((variantResult?.failures || []).map((entry) => [entry.itemKey, entry]));

    for (const plan of productSuccessPlans) {
        if (failedProductKeys.has(plan.itemKey)) continue;
        const failedVariant = failedVariantMap.get(plan.itemKey);
        if (failedVariant) {
            try {
                await rollbackFailedImportPlan({ db, plan, productRepo, variantRepo, dimensionRepo });
            } catch (rollbackError) {
                console.error('Batch product rollback failed:', rollbackError);
            }
            summary.failedProducts += 1;
            updatedProductIds.delete(plan.productId);
            const itemLabel = formatImportItemName(plan);
            errors.push(`Failed to process item ${itemLabel}: ${failedVariant.error?.message || 'Variant upsert failed'}`);
            continue;
        }

        const successEntry = successfulVariantMap.get(plan.itemKey);
        if (!successEntry) {
            try {
                await rollbackFailedImportPlan({ db, plan, productRepo, variantRepo, dimensionRepo });
            } catch (rollbackError) {
                console.error('Batch product rollback failed:', rollbackError);
            }
            summary.failedProducts += 1;
            updatedProductIds.delete(plan.productId);
            const itemLabel = formatImportItemName(plan);
            errors.push(`Failed to process item ${itemLabel}: Variant upsert did not return result`);
            continue;
        }

        const stats = normalizeStats(successEntry.stats, successEntry.fallbackStats);
        if (plan.operation === 'created') {
            summary.createdProducts += 1;
        } else if (plan.operation === 'updated') {
            summary.updatedProducts += 1;
        }
        summary.createdVariants += stats.createdCount;
        summary.updatedVariants += stats.updatedCount;
        summary.archivedVariants += stats.archivedCount;
        summary.reactivatedVariants += stats.reactivatedCount;
    }
}
