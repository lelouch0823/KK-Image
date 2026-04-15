import { parseJsonArray, parseJsonObject } from '@/utils/json.js';

export function toOptionModel(raw = {}) {
  const values = [];
  const metaMap = {};

  if (Array.isArray(raw.values)) {
    raw.values.forEach((entry) => {
      const value = typeof entry === 'string' ? entry : entry?.value;
      const cleanValue = String(value || '').trim();
      if (cleanValue && entry?.status !== 'archived') {
        values.push(cleanValue);
        if (entry?.meta) {
          const metaObj = typeof entry.meta === 'string'
            ? parseJsonObject(entry.meta, null)
            : entry.meta;
          if (metaObj) metaMap[cleanValue] = metaObj;
        }
      }
    });
  }

  return {
    id: raw.id || null,
    name: String(raw.name || '').trim(),
    values: [...new Set(values)],
    metaMap,
    inputValue: '',
    archivedValues: Array.isArray(raw.values)
      ? raw.values.filter(
          (entry) => entry && typeof entry === 'object' && entry.status === 'archived'
        )
      : [],
  };
}

export function buildOptionsFromDimensions(data) {
  if (Array.isArray(data?.dimensions) && data.dimensions.length > 0) {
    return data.dimensions
      .filter((dimension) => dimension?.status !== 'archived')
      .map((dimension) =>
        toOptionModel({
          id: dimension.id,
          name: dimension.name,
          values: dimension.values || [],
        })
      )
      .filter((dimension) => dimension.name);
  }
  return parseJsonArray(data?.options, []).map((option) => toOptionModel(option));
}

export function cloneDimensions(dimensions = []) {
  return (dimensions || []).map((dimension) => ({
    ...dimension,
    values: Array.isArray(dimension?.values)
      ? dimension.values.map((value) => ({ ...value }))
      : [],
  }));
}

export function buildDimensionNameLookup(data) {
  const fromMap = Object.entries(data?.dimension_map || {}).reduce((acc, [id, name]) => {
    const cleanId = String(id || '').trim();
    const cleanName = String(name || '').trim();
    if (cleanId && cleanName) acc[cleanId] = cleanName;
    return acc;
  }, {});

  return (data?.dimensions || []).reduce((acc, dimension) => {
    const cleanId = String(dimension?.id || '').trim();
    const cleanName = String(dimension?.name || '').trim();
    if (cleanId && cleanName) acc[cleanId] = cleanName;
    return acc;
  }, fromMap);
}

export function normalizeVariantOptionKeysToNames(variant, dimensionNameLookup = {}) {
  const normalizedOptions = Object.entries(variant?.options_values || {}).reduce((acc, [key, value]) => {
    const cleanKey = String(key || '').trim();
    const nextKey = dimensionNameLookup[cleanKey] || cleanKey;
    if (!nextKey) return acc;
    acc[nextKey] = value;
    return acc;
  }, {});

  return {
    ...variant,
    options_values: normalizedOptions,
  };
}
