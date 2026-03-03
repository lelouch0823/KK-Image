import { ensureVariantFolder, moveFilesToFolder } from '../../../../../api/utils/folder-utils.js';

function normalizeImageId(image) {
  if (typeof image === 'string') return image.trim();
  if (!image || typeof image !== 'object') return '';
  return String(image.image_id || image.id || '').trim();
}

/**
 * 将变体图片按变体归档到专属目录。
 * 若同一图片被多个变体引用，默认采用首次出现的变体，避免同一文件被反复迁移。
 */
export async function archiveVariantImagesByFolder(env, productId, tasks = []) {
  const imageOwnerVariant = new Map();
  const variantToImageIds = new Map();

  for (const task of tasks || []) {
    const variantId = String(task?.variantId || '').trim();
    if (!variantId) continue;

    const images = Array.isArray(task?.images) ? task.images : [];
    for (const image of images) {
      const imageId = normalizeImageId(image);
      if (!imageId) continue;
      if (imageOwnerVariant.has(imageId)) continue;
      imageOwnerVariant.set(imageId, variantId);
    }
  }

  for (const [imageId, variantId] of imageOwnerVariant.entries()) {
    if (!variantToImageIds.has(variantId)) {
      variantToImageIds.set(variantId, new Set());
    }
    variantToImageIds.get(variantId).add(imageId);
  }

  for (const [variantId, imageIdsSet] of variantToImageIds.entries()) {
    const imageIds = [...imageIdsSet];
    if (imageIds.length === 0) continue;
    const folderId = await ensureVariantFolder(env, productId, variantId);
    await moveFilesToFolder(env, imageIds, folderId);
  }
}
