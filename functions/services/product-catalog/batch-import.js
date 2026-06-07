import { generateId } from '../../api/utils/id.js';
import { BadRequestError } from '../../lib/hono/errors.js';

export const IMPORT_MODE = {
  REPLACE: 'replace',
  SAFE_MERGE: 'safe_merge',
};

export const PRODUCT_MUTABLE_FIELDS = new Set([
  'name',
  'spu',
  'slug',
  'category',
  'brand',
  'series',
  'currency',
  'description',
  'images',
  'specifications',
  'options',
]);

export const hasOwnMeta = (value) =>
  value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'meta');

export const normalizeMeta = (meta) => {
  if (meta === undefined || meta === null || meta === '') return null;
  return typeof meta === 'string' ? meta : JSON.stringify(meta);
};

export const hasVariantOptionSelections = (variants = []) =>
  (variants || []).some((variant) =>
    Object.entries(variant?.options_values || {}).some(
      ([key, value]) =>
        String(key || '').trim() &&
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
    )
  );

export const normalizeAlertThreshold = (value, fallback = 10) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export function buildCatalogRollbackPayload(variants = []) {
  return (variants || []).map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    price: Number(variant.price) || 0,
    cost_price:
      variant.cost_price !== undefined && variant.cost_price !== null
        ? Number(variant.cost_price)
        : null,
    alert_threshold: normalizeAlertThreshold(variant.alert_threshold),
    options_values: variant.options_values || {},
    image_id: variant.image_id || null,
    status: variant.status || 'active',
    barcode: variant.barcode ?? null,
    supplier_sku: variant.supplier_sku ?? null,
  }));
}

export function buildProductRollbackPayload(product = {}) {
  const rollback = {};
  for (const field of PRODUCT_MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(product, field)) {
      rollback[field] = product[field];
    }
  }
  return rollback;
}

export const cloneVariantImages = (images = []) => (images || []).map((image) => ({ ...image }));

export function assignGeneratedSkuForPatchVariants(variants = [], variantRepo) {
  return (variants || []).map((variant) => {
    if (String(variant?.sku || '').trim() || String(variant?.id || '').trim()) {
      return variant;
    }

    const fallbackSeed =
      variant._clientKey ||
      variant.variant_code ||
      JSON.stringify(variant.options_values || {}) ||
      generateId();
    const buildFallbackVariantSku =
      typeof variantRepo?.buildFallbackVariantSku === 'function'
        ? variantRepo.buildFallbackVariantSku.bind(variantRepo)
        : (value) =>
            `SKU-${String(value || generateId())
              .replace(/[^a-zA-Z0-9]+/g, '')
              .toUpperCase()}`;

    return {
      ...variant,
      sku: buildFallbackVariantSku(fallbackSeed),
    };
  });
}

export const normalizeImportMode = (value) => {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  if (!mode) return IMPORT_MODE.SAFE_MERGE;
  if (mode === IMPORT_MODE.SAFE_MERGE) return IMPORT_MODE.SAFE_MERGE;
  if (mode === IMPORT_MODE.REPLACE) return IMPORT_MODE.REPLACE;
  throw new BadRequestError('Invalid import mode');
};

export const assertBatchItem = (item) => {
  const name = String(item?.name || '').trim();
  if (!name) {
    throw new Error('name is required');
  }
  item.name = name;

  if (!Array.isArray(item?.variants) || item.variants.length === 0) {
    throw new Error('at least one variant is required');
  }

  const seenSkus = new Set();
  item.variants.forEach((variant, index) => {
    const sku = String(variant?.sku || '').trim();
    if (!sku) {
      throw new Error(`variant #${index + 1} sku is required`);
    }
    if (seenSkus.has(sku)) {
      throw new Error(`variant sku duplicated: ${sku}`);
    }
    seenSkus.add(sku);
    variant.sku = sku;
  });
};
