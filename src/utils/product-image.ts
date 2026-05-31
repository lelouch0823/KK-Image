import { parseJsonArray } from '@/utils/json.js';

const ABSOLUTE_SRC_PATTERN = /^(https?:)?\/\//i;

/** 图片引用对象 (可能包含多种标识字段) */
interface ImageRefObject {
  image_id?: string;
  id?: string;
  url?: string;
  storage_key?: string;
  path?: string;
  is_primary?: number;
  [key: string]: unknown;
}

/** 产品对象 (用于图片解析) */
export interface ProductWithImages {
  images?: string | unknown[];
  primaryImage?: string | ImageRefObject;
  mainImage?: string | ImageRefObject;
  display_image_id?: string;
  selectedVariant?: VariantWithImages;
  variant?: VariantWithImages;
  [key: string]: unknown;
}

/** 变体对象 (用于图片解析) */
export interface VariantWithImages {
  primaryImage?: string | ImageRefObject;
  image_id?: string;
  images?: ImageRefObject[];
  [key: string]: unknown;
}

/** 判断值是否为图片引用对象 */
function isImageRefObject(value: unknown): value is ImageRefObject {
  return typeof value === 'object' && value !== null;
}

export const parseProductImages = (rawImages: unknown): unknown[] => {
  if (!rawImages) return [];
  if (Array.isArray(rawImages)) return rawImages;
  if (typeof rawImages !== 'string') return [];

  return parseJsonArray(rawImages, []);
};

export const normalizeImageRef = (image: unknown): string | null => {
  if (typeof image === 'string') {
    const normalized = image.trim();
    return normalized || null;
  }

  if (!isImageRefObject(image)) return null;

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

const firstValidImageRef = (images: unknown[] = []): string | null => {
  for (const image of images) {
    const ref = normalizeImageRef(image);
    if (ref) return ref;
  }
  return null;
};

export const toImageSrc = (imageRef: unknown): string | null => {
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

export const resolvePrimaryProductImageRef = (product: ProductWithImages | null | undefined): string | null => {
  const images = parseProductImages(product?.images);
  return firstValidImageRef(images);
};

export const resolvePrimaryProductImageSrc = (product: ProductWithImages | null | undefined): string | null =>
  toImageSrc(resolvePrimaryProductImageRef(product));

export const resolveProductPreviewImageSrc = (product: ProductWithImages | null | undefined): string | null => {
  const preview = toImageSrc(normalizeImageRef(product?.primaryImage));
  if (preview) return preview;
  return resolvePrimaryProductImageSrc(product);
};

export const resolveVariantPrimaryImageRef = (variant: VariantWithImages | null | undefined): string | null => {
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

export const resolveVariantPrimaryImageSrc = (variant: VariantWithImages | null | undefined): string | null =>
  toImageSrc(resolveVariantPrimaryImageRef(variant));

export const resolveSelectedVariantMainImageSrc = (product: ProductWithImages | null | undefined): string | null => {
  const emittedMain = toImageSrc(normalizeImageRef(product?.mainImage));
  if (emittedMain) return emittedMain;

  const selectedVariant = product?.selectedVariant || product?.variant || product;
  return resolveVariantPrimaryImageSrc(selectedVariant as VariantWithImages);
};

export const resolveBoundProductMainImageSrc = (product: ProductWithImages | null | undefined): string | null => {
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

export const resolveProductImageSrcList = (product: ProductWithImages | null | undefined): string[] => {
  const images = parseProductImages(product?.images);
  const srcList = images
    .map((image) => toImageSrc(normalizeImageRef(image)))
    .filter(Boolean);
  return [...new Set(srcList)] as string[];
};
