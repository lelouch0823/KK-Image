const buildDimensionNameMap = (dimensions = []) =>
  (dimensions || []).reduce((acc, item) => {
    const id = String(item?.id || '').trim();
    const name = String(item?.name || '').trim();
    if (name && id) acc[name] = id;
    return acc;
  }, {});

export const normalizeVariantExternalCodes = (variants = []) =>
  variants.map((variant) => ({
    ...variant,
    barcode: String(variant?.barcode ?? '').trim() || null,
    supplier_sku: String(variant?.supplier_sku ?? '').trim() || null,
  }));

export const normalizeVariantDimensionKeys = (variants = [], dimensions = []) => {
  const nameMap = buildDimensionNameMap(dimensions);
  return (variants || []).map((variant) => {
    const normalized = {};
    for (const [key, value] of Object.entries(variant?.options_values || {})) {
      const rawKey = String(key || '').trim();
      const nextKey = nameMap[rawKey] || rawKey;
      if (!nextKey) continue;
      if (value === undefined || value === null || String(value).trim() === '') continue;
      normalized[nextKey] = String(value);
    }
    return {
      ...variant,
      options_values: normalized,
    };
  });
};
