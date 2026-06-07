import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { buildOrderBindingSnapshot } from '../api/utils/order-binding-snapshot.js';

const PURCHASE_ORDER_SNAPSHOT_VARIANT_KEYS = ['size', 'color', 'material'];
const PURCHASE_ORDER_SIZE_LABELS = new Set(['size', '尺码', '尺寸']);
const PURCHASE_ORDER_COLOR_LABELS = new Set(['color', '颜色', '顏色']);
const PURCHASE_ORDER_MATERIAL_LABELS = new Set(['material', '材质', '材質']);

function buildPurchaseOrderSnapshotVariantOptions(snapshotSpecs = {}) {
  if (!snapshotSpecs || typeof snapshotSpecs !== 'object') return {};

  return PURCHASE_ORDER_SNAPSHOT_VARIANT_KEYS.reduce((acc, key) => {
    const value = snapshotSpecs[key];
    if (value === undefined || value === null || value === '') return acc;
    acc[key] = value;
    return acc;
  }, {});
}

export function mapPurchaseOrderSnapshotFields(row = {}) {
  const snapshotSpecs = parseJsonObject(row.snapshot_specs, {});
  const snapshotVariantOptions = buildPurchaseOrderSnapshotVariantOptions(snapshotSpecs);
  const hasSnapshotVariantOptions = Object.keys(snapshotVariantOptions).length > 0;
  const liveVariantOptions = parseJsonObject(row.variant_options, {});

  return {
    ...row,
    product_name: row.snapshot_name || row.product_name,
    product_brand: row.snapshot_brand || row.product_brand,
    variant_sku: row.snapshot_sku || row.variant_sku,
    product_images: row.snapshot_image
      ? [row.snapshot_image]
      : parseJsonArray(row.product_images, []),
    product_specifications: parseJsonObject(row.product_specifications, {}),
    variant_options: hasSnapshotVariantOptions ? snapshotVariantOptions : liveVariantOptions,
  };
}

export function normalizePurchaseItemSnapshotSpecs(rawSnapshotSpecs = {}) {
  const snapshotSpecs = parseJsonObject(rawSnapshotSpecs, {});
  return JSON.stringify({
    brand: snapshotSpecs.brand || '',
    size: snapshotSpecs.size || '',
    color: snapshotSpecs.color || '',
    material: snapshotSpecs.material || '',
    series: snapshotSpecs.series || '',
  });
}

function resolvePurchaseItemSnapshotSize({ product, variant, fallback = '' }) {
  const options = parseJsonObject(variant?.options_values, {});
  const dimensionMap = product?.dimension_map || {};
  const otherSpecs = [];

  for (const [key, rawValue] of Object.entries(options)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    const readableKey = String(dimensionMap[key] || key);
    const normalizedKey = readableKey.toLowerCase();
    const value = String(rawValue);

    if (
      PURCHASE_ORDER_COLOR_LABELS.has(normalizedKey) ||
      PURCHASE_ORDER_MATERIAL_LABELS.has(normalizedKey)
    ) {
      continue;
    }
    if (PURCHASE_ORDER_SIZE_LABELS.has(normalizedKey)) {
      return value;
    }
    otherSpecs.push(`${readableKey}: ${value}`);
  }

  return otherSpecs.join('，') || fallback;
}

export function buildLivePurchaseItemSnapshot({ product, variant }) {
  const snapshot = buildOrderBindingSnapshot({ product, variant, fallback: {} });
  const productImages = parseJsonArray(product?.images, []);
  return {
    snapshot_name: snapshot.name || '',
    snapshot_sku: snapshot.sku || '',
    snapshot_specs: normalizePurchaseItemSnapshotSpecs({
      brand: snapshot.brand || '',
      size: resolvePurchaseItemSnapshotSize({ product, variant, fallback: snapshot.size || '' }),
      color: snapshot.color || '',
      material: snapshot.material || '',
      series: snapshot.series || '',
    }),
    snapshot_image: variant?.image_id || productImages[0] || null,
  };
}
