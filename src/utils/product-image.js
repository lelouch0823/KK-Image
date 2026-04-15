import { parseJsonArray } from '@/utils/json.js';

const ABSOLUTE_SRC_PATTERN = /^(https?:)?\/\//i;

export const parseProductImages = (rawImages) => {
  if (!rawImages) return [];
  if (Array.isArray(rawImages)) return rawImages;
  if (typeof rawImages !== 'string') return [];

  return parseJsonArray(rawImages, []);
};

export const normalizeImageRef = (image) => {
  if (typeof image === 'string') {
    const normalized = image.trim();
    return normalized || null;
  }

  if (!image || typeof image !== 'object') return null;

  const candidates = [
    image.image_id,
    image.id,
    image.url,
    image.storage_key,
    image.path,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim();
      if (normalized) return normalized;
    }
  }

  return null;
};

const firstValidImageRef = (images = []) => {
  for (const image of images) {
    const ref = normalizeImageRef(image);
    if (ref) return ref;
  }
  return null;
};

export const toImageSrc = (imageRef) => {
  if (!imageRef) return null;
  const normalized = String(imageRef).trim();
  if (!normalized) return null;
  if (
    ABSOLUTE_SRC_PATTERN.test(normalized) ||
    normalized.startsWith('/') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) {
    return normalized;
  }
  return `/file/${normalized}`;
};

export const resolvePrimaryProductImageRef = (product) => {
  const images = parseProductImages(product?.images);
  return firstValidImageRef(images);
};

export const resolvePrimaryProductImageSrc = (product) =>
  toImageSrc(resolvePrimaryProductImageRef(product));

export const resolveProductPreviewImageSrc = (product) => {
  const preview = toImageSrc(normalizeImageRef(product?.primaryImage));
  if (preview) return preview;
  return resolvePrimaryProductImageSrc(product);
};

export const resolveVariantPrimaryImageRef = (variant) => {
  if (!variant || typeof variant !== 'object') return null;
  const candidates = [variant.primaryImage, variant.image_id];
  for (const candidate of candidates) {
    const normalized = normalizeImageRef(candidate);
    if (normalized) return normalized;
  }

  const images = Array.isArray(variant.images) ? variant.images : [];
  if (images.length === 0) return null;
  const primary = images.find((img) => Number(img?.is_primary) === 1);
  const primaryRef = normalizeImageRef(primary);
  if (primaryRef) return primaryRef;
  return firstValidImageRef(images);
};

export const resolveVariantPrimaryImageSrc = (variant) =>
  toImageSrc(resolveVariantPrimaryImageRef(variant));

export const resolveSelectedVariantMainImageSrc = (product) => {
  const emittedMain = toImageSrc(normalizeImageRef(product?.mainImage));
  if (emittedMain) return emittedMain;

  const selectedVariant = product?.selectedVariant || product?.variant || product;
  return resolveVariantPrimaryImageSrc(selectedVariant);
};

export const resolveBoundProductMainImageSrc = (product) => {
  const productMain = toImageSrc(normalizeImageRef(product?.mainImage));
  if (productMain) return productMain;

  const variantMain = resolveVariantPrimaryImageSrc(product?.selectedVariant);
  if (variantMain) return variantMain;

  const variantPrimary = resolveVariantPrimaryImageSrc(product?.variant);
  if (variantPrimary) return variantPrimary;

  const productPrimary =
    toImageSrc(normalizeImageRef(product?.primaryImage)) || resolvePrimaryProductImageSrc(product);
  if (productPrimary) return productPrimary;

  return toImageSrc(normalizeImageRef(product?.display_image_id));
};

export const resolveProductImageSrcList = (product) => {
  const images = parseProductImages(product?.images);
  const srcList = images
    .map((image) => toImageSrc(normalizeImageRef(image)))
    .filter(Boolean);
  return [...new Set(srcList)];
};
