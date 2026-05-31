import { parseJsonArray, parseJsonObject } from '@/utils/json.js';

interface DimensionValue {
  value: string;
  status?: string;
  meta?: unknown;
  [key: string]: unknown;
}

interface Dimension {
  id?: string;
  name?: string;
  status?: string;
  values?: DimensionValue[];
  [key: string]: unknown;
}

interface OptionModel {
  id: string | null;
  name: string;
  values: string[];
  metaMap: Record<string, unknown>;
  inputValue: string;
  archivedValues: DimensionValue[];
}

interface DataWithDimensions {
  dimensions?: Dimension[];
  options?: unknown;
  dimension_map?: Record<string, string>;
  [key: string]: unknown;
}

export function toOptionModel(raw: Record<string, unknown> = {}): OptionModel {
  const values: string[] = [];
  const metaMap: Record<string, unknown> = {};

  if (Array.isArray(raw.values)) {
    (raw.values as unknown[]).forEach((entry) => {
      const e = entry as DimensionValue | string;
      const value = typeof e === 'string' ? e : e?.value;
      const cleanValue = String(value || '').trim();
      if (cleanValue && (typeof e === 'object' && e?.status !== 'archived')) {
        values.push(cleanValue);
        if (typeof e === 'object' && e?.meta) {
          const metaObj = typeof e.meta === 'string'
            ? parseJsonObject(e.meta, null)
            : e.meta;
          if (metaObj) metaMap[cleanValue] = metaObj;
        }
      }
    });
  }

  return {
    id: (raw.id as string) || null,
    name: String(raw.name || '').trim(),
    values: [...new Set(values)],
    metaMap,
    inputValue: '',
    archivedValues: Array.isArray(raw.values)
      ? (raw.values as unknown[]).filter(
          (entry): entry is DimensionValue => entry !== null && typeof entry === 'object' && (entry as DimensionValue).status === 'archived'
        )
      : [],
  };
}

export function buildOptionsFromDimensions(data: DataWithDimensions): OptionModel[] {
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
  return parseJsonArray(data?.options, []).map((option) => toOptionModel(option as Record<string, unknown>));
}

export function cloneDimensions(dimensions: Dimension[] = []): Dimension[] {
  return (dimensions || []).map((dimension) => ({
    ...dimension,
    values: Array.isArray(dimension?.values)
      ? dimension.values.map((value) => ({ ...value }))
      : [],
  }));
}

export function buildDimensionNameLookup(data: DataWithDimensions): Record<string, string> {
  const fromMap = Object.entries(data?.dimension_map || {}).reduce<Record<string, string>>((acc, [id, name]) => {
    const cleanId = String(id || '').trim();
    const cleanName = String(name || '').trim();
    if (cleanId && cleanName) acc[cleanId] = cleanName;
    return acc;
  }, {});

  return (data?.dimensions || []).reduce<Record<string, string>>((acc, dimension) => {
    const cleanId = String(dimension?.id || '').trim();
    const cleanName = String(dimension?.name || '').trim();
    if (cleanId && cleanName) acc[cleanId] = cleanName;
    return acc;
  }, fromMap);
}

export function normalizeVariantOptionKeysToNames(variant: Record<string, unknown>, dimensionNameLookup: Record<string, string> = {}): Record<string, unknown> {
  const optionsValues = (variant?.options_values || {}) as Record<string, string>;
  const normalizedOptions = Object.entries(optionsValues).reduce<Record<string, string>>((acc, [key, value]) => {
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
