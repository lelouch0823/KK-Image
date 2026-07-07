import { generateId } from '../../api/utils/id.js';
import { normalizeVariantExternalCodes } from '../_shared/variant-normalizers.js';
import { BadRequestError } from '../../lib/hono/errors.js';
import { validateProductPayload } from '../_shared/product-schema.js';
import { assertBatchItem, IMPORT_MODE, normalizeImportMode } from './batch-import.js';
import { preloadBatchImportExistingState, chunkBatchImportItems } from './preload-existing.js';
import { executeBulkProductImportUpsert } from './bulk-upsert.js';
import { buildSafeProductUpdateData } from './variant-matching.js';

const BATCH_IMPORT_LIMIT = 500;

function normalizeSpu(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function buildProductImportPayload(normalizedItem = {}) {
  const productData = { ...normalizedItem };
  delete productData.variants;
  delete productData.dimensions;
  return productData;
}

function normalizeBatchImportVariants(variants = []) {
  return (Array.isArray(variants) ? variants : []).map((variant) => ({
    ...variant,
    cost_price: variant?.cost_price ?? 0,
    stock_quantity: variant?.stock_quantity ?? 0,
    alert_threshold: variant?.alert_threshold ?? 10,
    status: variant?.status || 'active',
  }));
}

function buildImportErrorLabel(item = {}) {
  return item?.spu || item?.name || 'UNKNOWN';
}

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

  if (items.length > BATCH_IMPORT_LIMIT) {
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

  for (const chunk of chunkBatchImportItems(items)) {
    const existingState = await preloadBatchImportExistingState({
      items: chunk,
      productRepo,
      variantRepo,
      dimensionRepo,
    });

    const plans = [];
    for (const item of chunk) {
      try {
        assertBatchItem(item);
        const normalizedItem = validateProductPayload(
          {
            ...item,
            variants: normalizeVariantExternalCodes(normalizeBatchImportVariants(item.variants)),
          },
          { requireVariants: true }
        );
        const spu = normalizeSpu(normalizedItem.spu);
        const existingProduct = spu ? existingState.productsBySpu.get(spu) || null : null;

        if (existingProduct) {
          const productId = existingProduct.id;
          const existingProductSnapshot =
            existingState.productsById.get(productId) || existingProduct;
          const existingVariantsSnapshot = existingState.variantsByProductId.get(productId) || [];
          const existingDimensionsSnapshot =
            existingState.dimensionsByProductId.get(productId) || [];
          const updateData = buildProductImportPayload(normalizedItem);
          const nextUpdateData =
            importMode === IMPORT_MODE.SAFE_MERGE
              ? buildSafeProductUpdateData(
                  existingProductSnapshot || existingProduct,
                  updateData,
                  conflicts
                )
              : updateData;

          plans.push({
            itemKey: spu || normalizedItem.name,
            normalizedItem,
            operation: 'updated',
            productId,
            productData: nextUpdateData,
            needsProductUpsert: Object.keys(nextUpdateData).length > 0,
            existingProductSnapshot,
            existingVariantsSnapshot,
            existingDimensionsSnapshot,
          });
          updatedProductIds.add(productId);
          continue;
        }

        const productId = generateId();
        plans.push({
          itemKey: spu || normalizedItem.name,
          normalizedItem,
          operation: 'created',
          productId,
          productData: buildProductImportPayload(normalizedItem),
          needsProductUpsert: true,
          existingProductSnapshot: null,
          existingVariantsSnapshot: [],
          existingDimensionsSnapshot: [],
        });
        updatedProductIds.add(productId);
      } catch (error) {
        summary.failedProducts += 1;
        errors.push(`Failed to process item ${buildImportErrorLabel(item)}: ${error.message}`);
      }
    }

    await executeBulkProductImportUpsert({
      db,
      plans,
      importMode,
      productRepo,
      variantRepo,
      dimensionRepo,
      syncDimensionsFromPayload,
      summary,
      errors,
      conflicts,
      updatedProductIds,
    });
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
