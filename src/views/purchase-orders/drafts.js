export function normalizeReceiptQty(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}

export function normalizeDecimal(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeNullableDecimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isReceiptDraftInvalid(entry = {}) {
  return normalizeReceiptQty(entry.received_qty) > Number(entry.max_receivable || 0);
}

export function isShortageDraftInvalid(entry = {}) {
  return normalizeReceiptQty(entry.close_qty) > Number(entry.max_closable || 0);
}

export const buildSuggestionVariantLabel = (variantOptions = {}) =>
  Object.values(variantOptions || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' / ');

export const buildSuggestionMeta = (suggestion) => {
  const sku = String(suggestion?.sku || '').trim();
  const brand = String(suggestion?.brand || '').trim();
  return [sku || '—', brand || '-'].join(' · ');
};

export function getSuggestionOrderIds(suggestion = {}) {
  return [...new Set((suggestion.order_ids || []).filter(Boolean))];
}
