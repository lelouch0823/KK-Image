import {
  normalizeVariantDimensionKeys,
  normalizeVariantExternalCodes,
} from '../../lib/hono/routes/manage/products/variant-normalizers.js';
import { BadRequestError } from '../../lib/hono/errors.js';
import { validateProductPayload } from '../../lib/hono/routes/manage/products/product-schema.js';
import {
  assignGeneratedSkuForPatchVariants,
  hasVariantOptionSelections,
  PRODUCT_MUTABLE_FIELDS,
} from './batch-import.js';
import { loadVariantImageSnapshot, rollbackPatchedProduct } from './maintenance.js';
import { syncCatalogVariantImages } from './variant-images.js';

export async function executeProductCatalogPatch({
  db,
  env,
  productId,
  body,
  fullReplace = false,
  ensureProductExists,
  syncDimensionsFromPayload,
  productRepo,
  variantRepo,
  dimensionRepo,
  auditRepo,
  isVariantSyncValidationError,
}) {
  const existingProductSnapshot = await ensureProductExists(productId);

  const incomingDimensions = Array.isArray(body.dimensions) ? body.dimensions : null;
  const nextBody = { ...body };
  if (nextBody.dimensions !== undefined) delete nextBody.dimensions;

  Object.assign(
    nextBody,
    validateProductPayload(nextBody, {
      allowExistingVariantStockOmission: true,
      allowGeneratedVariantSku: true,
    })
  );

  let existingDimensionsForVariantSync = null;
  if (fullReplace && nextBody.variants !== undefined && !Array.isArray(body.dimensions)) {
    const hasIncomingDimensionedVariants = hasVariantOptionSelections(nextBody.variants);
    existingDimensionsForVariantSync = await dimensionRepo.listByProduct(productId);
    const hasExistingActiveDimensions = (existingDimensionsForVariantSync || []).some(
      (dimension) => dimension?.status !== 'archived'
    );

    if (hasIncomingDimensionedVariants || hasExistingActiveDimensions) {
      throw new BadRequestError(
        'dimensions must be provided explicitly when replacing variants in full replace mode'
      );
    }
  }

  const hasProductFieldUpdates = Object.keys(nextBody).some((key) =>
    PRODUCT_MUTABLE_FIELDS.has(key)
  );
  const shouldRollbackDimensions = Boolean(incomingDimensions);
  const existingDimensionsSnapshot = shouldRollbackDimensions
    ? await dimensionRepo.listByProduct(productId)
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
      syncedDimensions = await syncDimensionsFromPayload(productId, incomingDimensions, {
        replaceMissing: fullReplace,
      });
      dimensionsUpdated = true;
    }

    if (nextBody.variants !== undefined) {
      beforeVariants = await variantRepo.findByProductId(productId);
      beforeVariantImages = await loadVariantImageSnapshot({
        db,
        productId,
        variants: beforeVariants,
        variantRepo,
      });

      const dimensions =
        syncedDimensions ||
        existingDimensionsForVariantSync ||
        (await dimensionRepo.listByProduct(productId));
      nextBody.variants = normalizeVariantDimensionKeys(
        assignGeneratedSkuForPatchVariants(
          normalizeVariantExternalCodes(nextBody.variants),
          variantRepo
        ),
        dimensions
      );
    }

    result = hasProductFieldUpdates
      ? await productRepo.updateWithMeta(productId, nextBody)
      : { success: true, changes: 0 };
    productUpdated = Boolean(hasProductFieldUpdates && result.success && result.changes > 0);

    if (result.success && nextBody.variants !== undefined) {
      try {
        const syncResult = await variantRepo.syncVariants(productId, nextBody.variants);
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

      afterVariants = await variantRepo.findByProductId(productId);
      await syncCatalogVariantImages({
        db,
        env,
        productId,
        inputVariants: nextBody.variants,
        persistedVariants: afterVariants,
        variantRepo,
        archiveLogLabel: 'product patch',
      });

      const events = variantRepo.buildAuditEvents(productId, beforeVariants, afterVariants);
      await auditRepo.createBatch(events);
      variantsUpdated = true;
    }
  } catch (error) {
    if (productUpdated || shouldRollbackDimensions || didSyncVariants) {
      try {
        await rollbackPatchedProduct({
          db,
          productRepo,
          dimensionRepo,
          variantRepo,
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
