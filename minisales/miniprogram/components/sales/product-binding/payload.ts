type BoundValue = {
  productId?: string;
  variantId?: string;
  name?: string;
  brand?: string;
  series?: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  variantLabel?: string;
  primaryImage?: string;
};

type ProductSummary = {
  id: string;
  name: string;
  brand: string;
  series: string;
  primaryImage: string;
  dimensionMap?: Record<string, string>;
};

type ProductVariant = {
  id: string;
  sku: string;
  displayName: string;
  optionsValues: Record<string, string>;
  primaryImage: string;
};

const COLOR_LABELS = new Set(['color', '颜色', '顏色']);
const MATERIAL_LABELS = new Set(['material', '材质', '材質']);

function normalizeLabel(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function buildVariantPayload(product: ProductSummary, variant: ProductVariant): BoundValue {
  const options = variant.optionsValues || {};
  const dimensionMap = product.dimensionMap || {};
  const otherSpecs: string[] = [];
  let color = '';
  let material = '';

  for (const [key, rawValue] of Object.entries(options)) {
    const value = String(rawValue || '').trim();
    if (!value) continue;

    const readableKey = String(dimensionMap[key] || key || '').trim();
    const normalizedKey = normalizeLabel(readableKey);

    if (COLOR_LABELS.has(normalizedKey)) {
      color = value;
      continue;
    }

    if (MATERIAL_LABELS.has(normalizedKey)) {
      material = value;
      continue;
    }

    otherSpecs.push(readableKey ? `${readableKey}: ${value}` : value);
  }

  return {
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    brand: product.brand,
    series: product.series,
    sku: variant.sku,
    size: otherSpecs.join('，'),
    color,
    material,
    variantLabel: variant.displayName,
    primaryImage: variant.primaryImage || product.primaryImage,
  };
}
