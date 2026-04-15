import { VariantImageRepository } from '../../repositories/VariantImageRepository.js';
import { archiveVariantImagesByFolder } from '../../lib/hono/routes/manage/products/variant-image-folders.js';
import { resolveVariantImageSyncPlan } from '../../lib/hono/routes/manage/products/variant-image-sync.js';
import { BadRequestError } from '../../lib/hono/errors.js';

export async function syncCatalogVariantImages({
  db,
  env,
  productId,
  inputVariants,
  persistedVariants,
  variantRepo,
  variantImageRepo = new VariantImageRepository(db, variantRepo),
  resolvePlan = resolveVariantImageSyncPlan,
  archiveByFolder = archiveVariantImagesByFolder,
  logError = console.error,
  archiveLogLabel = 'product sync',
}) {
  const imageSyncPlan = resolvePlan({
    inputVariants,
    persistedVariants,
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
    await archiveByFolder(env, productId, imageSyncPlan.tasks);
  } catch (error) {
    logError(`Archive variant images by folder failed (${archiveLogLabel}):`, error);
  }
}
