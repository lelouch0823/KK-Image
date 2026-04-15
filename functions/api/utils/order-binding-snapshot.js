import { parseJsonObject } from './json.js';

const COLOR_LABELS = new Set(['color', '颜色', '顏色']);
const MATERIAL_LABELS = new Set(['material', '材质', '材質']);

function parseOptionsValues(optionsValues) {
  if (!optionsValues) return {};
  return parseJsonObject(optionsValues, {});
}

export function buildOrderBindingSnapshot({ product, variant, fallback = {} } = {}) {
  if (!product || !variant) return { ...fallback };

  const options = parseOptionsValues(variant.options_values);
  const dimensionMap = product.dimension_map || {};
  let color = '';
  let material = '';
  const otherSpecs = [];

  for (const [key, rawValue] of Object.entries(options)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    const readableKey = String(dimensionMap[key] || key);
    const normalizedKey = readableKey.toLowerCase();
    const value = String(rawValue);

    if (COLOR_LABELS.has(normalizedKey)) {
      color = value;
      continue;
    }
    if (MATERIAL_LABELS.has(normalizedKey)) {
      material = value;
      continue;
    }
    otherSpecs.push(`${readableKey}: ${value}`);
  }

  return {
    ...fallback,
    name: product.name || fallback.name || '',
    brand: product.brand || fallback.brand || '',
    category: product.category || fallback.category || '',
    series: product.series || fallback.series || '',
    sku: variant.sku || fallback.sku || '',
    color: color || fallback.color || '',
    material: material || product.specifications?.material || fallback.material || '',
    size: otherSpecs.join('，') || fallback.size || '',
  };
}
