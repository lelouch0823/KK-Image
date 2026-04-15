import { VariantImageRepository } from '../../repositories/VariantImageRepository.js';
import {
  buildCatalogRollbackPayload,
  buildProductRollbackPayload,
  cloneVariantImages,
} from './batch-import.js';

export async function cleanupCreatedCatalogRecords({ db, created }) {
  for (const variantId of created.variantIds) {
    await db.prepare('DELETE FROM variant_images WHERE variant_id = ?').bind(variantId).run();
    await db.prepare('DELETE FROM product_variants WHERE id = ?').bind(variantId).run();
  }

  for (const valueId of created.dimensionValueIds) {
    await db.prepare('DELETE FROM product_dimension_values WHERE id = ?').bind(valueId).run();
  }

  for (const dimensionId of created.dimensionIds) {
    await db.prepare('DELETE FROM product_dimensions WHERE id = ?').bind(dimensionId).run();
  }

  if (created.productId) {
    await db.prepare('DELETE FROM products WHERE id = ?').bind(created.productId).run();
  }
}

export async function loadVariantImageSnapshot({
  db,
  productId,
  variants = [],
  variantRepo,
  variantImageRepo = new VariantImageRepository(db, variantRepo),
}) {
  const snapshot = new Map();
  for (const variant of variants || []) {
    const variantId = String(variant?.id || '').trim();
    if (!variantId) continue;
    const images = await variantImageRepo.listByVariant({ productId, variantId });
    snapshot.set(variantId, cloneVariantImages(images));
  }
  return snapshot;
}

export async function rollbackPatchedProduct({
  db,
  productRepo,
  dimensionRepo,
  variantRepo,
  productId,
  existingProductSnapshot = null,
  existingDimensionsSnapshot = null,
  shouldRollbackProduct = false,
  shouldRollbackDimensions = false,
  didSyncVariants = false,
  beforeVariants = [],
  beforeVariantImages = new Map(),
  afterVariants = [],
}) {
  if (shouldRollbackProduct && existingProductSnapshot) {
    const rollbackProductData = buildProductRollbackPayload(existingProductSnapshot);
    if (Object.keys(rollbackProductData).length > 0) {
      await productRepo.updateWithMeta(productId, rollbackProductData);
    }
  }

  if (
    shouldRollbackDimensions
    && existingDimensionsSnapshot
    && typeof dimensionRepo.restoreSnapshot === 'function'
  ) {
    await dimensionRepo.restoreSnapshot(productId, existingDimensionsSnapshot);
  }

  if (!didSyncVariants || !beforeVariants) return;

  await variantRepo.syncVariants(productId, buildCatalogRollbackPayload(beforeVariants));

  const variantImageRepo = new VariantImageRepository(db, variantRepo);
  const beforeVariantIds = new Set(
    (beforeVariants || [])
      .map((variant) => String(variant?.id || '').trim())
      .filter(Boolean)
  );
  const rollbackVariantIds = new Set([
    ...Array.from(beforeVariantIds),
    ...((afterVariants || [])
      .map((variant) => String(variant?.id || '').trim())
      .filter(Boolean)),
  ]);

  for (const variantId of rollbackVariantIds) {
    const images = beforeVariantIds.has(variantId)
      ? cloneVariantImages(beforeVariantImages.get(variantId) || [])
      : [];
    await variantImageRepo.syncImages(productId, variantId, images);
  }
}
