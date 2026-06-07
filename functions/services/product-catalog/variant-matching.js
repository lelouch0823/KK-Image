function appendLookup(lookup, key, variant) {
  if (!key) return;
  if (!lookup.has(key)) lookup.set(key, []);
  lookup.get(key).push(variant);
}

function pickUnmatchedVariant(lookup, key, matchedIds) {
  const list = lookup.get(key) || [];
  for (const item of list) {
    if (!matchedIds.has(item.id)) {
      return item;
    }
  }
  return null;
}

const isEmptyValue = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

const normalizeObjectValue = (value) => {
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = value[key];
      return acc;
    }, {});
};

const areValuesEqual = (a, b) => {
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(normalizeObjectValue(a)) === JSON.stringify(normalizeObjectValue(b));
  }
  return String(a ?? '') === String(b ?? '');
};

const safeMergeField = ({ target, incoming, field, context, conflicts, currentValue }) => {
  if (!(field in incoming)) return;
  const incomingValue = incoming[field];
  if (isEmptyValue(incomingValue)) return;

  const baseValue = currentValue !== undefined ? currentValue : target[field];
  if (isEmptyValue(baseValue) || areValuesEqual(baseValue, incomingValue)) {
    target[field] = incomingValue;
    return;
  }

  conflicts.push({
    ...context,
    field,
    current: currentValue,
    incoming: incomingValue,
  });
};

export const buildSafeProductUpdateData = (existing, incoming, conflicts) => {
  const next = {};
  const fields = [
    'name',
    'spu',
    'category',
    'brand',
    'series',
    'description',
    'currency',
    'slug',
    'images',
    'specifications',
    'options',
  ];
  fields.forEach((field) => {
    safeMergeField({
      target: next,
      incoming,
      field,
      currentValue: existing?.[field],
      conflicts,
      context: {
        level: 'product',
        spu: String(existing?.spu || incoming?.spu || '').trim() || null,
      },
    });
  });
  return next;
};

export const buildSafeVariantSyncPayload = (existingVariants, variantsToSync, conflicts, item) => {
  const existingById = new Map(existingVariants.map((variant) => [variant.id, variant]));
  const mutableFields = [
    'sku',
    'price',
    'cost_price',
    'stock_quantity',
    'alert_threshold',
    'options_values',
    'image_id',
    'status',
    'barcode',
    'supplier_sku',
  ];

  return variantsToSync.map((variant) => {
    if (!variant?.id || !existingById.has(variant.id)) {
      return variant;
    }
    const existing = existingById.get(variant.id);
    const merged = { ...existing };

    mutableFields.forEach((field) => {
      safeMergeField({
        target: merged,
        incoming: variant,
        field,
        conflicts,
        context: {
          level: 'variant',
          spu: String(item?.spu || '').trim() || null,
          sku: String(existing?.sku || variant?.sku || '').trim() || null,
        },
      });
    });

    return {
      ...merged,
      id: existing.id,
    };
  });
};

export const buildVariantMatchKey = (variant) => {
  const variantCode = String(variant?.variant_code || '').trim();
  if (variantCode) return `code:${variantCode}`;

  const sku = String(variant?.sku || '').trim();
  if (sku) return `sku:${sku}`;

  const optionsValues =
    variant?.options_values && typeof variant.options_values === 'object'
      ? variant.options_values
      : {};
  const entries = Object.entries(optionsValues)
    .map(([key, value]) => [String(key || '').trim(), String(value || '').trim()])
    .filter(([key, value]) => key && value)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  const signature = entries.map(([key, value]) => `${key}:${value}`).join('|');
  return `sig:${signature}`;
};

export const mergeIncomingWithExisting = (
  existingVariants,
  incomingVariants,
  { includeUnmatchedExisting = true } = {}
) => {
  const existingByCode = new Map();
  const existingBySku = new Map();
  const existingBySignature = new Map();
  const matchedExistingIds = new Set();
  existingVariants.forEach((variant) => {
    const code = String(variant?.variant_code || '').trim();
    const sku = String(variant?.sku || '').trim();
    const signature = buildVariantMatchKey(variant);

    appendLookup(existingByCode, code ? `code:${code}` : null, variant);
    appendLookup(existingBySku, sku ? `sku:${sku}` : null, variant);
    appendLookup(existingBySignature, signature, variant);
  });

  const merged = [];

  incomingVariants.forEach((incoming) => {
    let existing = null;

    const incomingCode = String(incoming?.variant_code || '').trim();
    if (incomingCode) {
      existing = pickUnmatchedVariant(existingByCode, `code:${incomingCode}`, matchedExistingIds);
    }

    const incomingSku = String(incoming?.sku || '').trim();
    if (!existing && incomingSku) {
      existing = pickUnmatchedVariant(existingBySku, `sku:${incomingSku}`, matchedExistingIds);
    }

    const incomingKey = buildVariantMatchKey(incoming);
    if (!existing && incomingKey?.startsWith('sig:')) {
      existing = pickUnmatchedVariant(existingBySignature, incomingKey, matchedExistingIds);
    }

    if (existing) {
      matchedExistingIds.add(existing.id);
      merged.push({
        ...incoming,
        id: existing.id,
      });
    } else {
      merged.push(incoming);
    }
  });

  if (includeUnmatchedExisting) {
    existingVariants.forEach((variant) => {
      if (!matchedExistingIds.has(variant.id)) {
        merged.push(variant);
      }
    });
  }

  return merged;
};
