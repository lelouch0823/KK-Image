export function normalizeReceiptQty(value: unknown): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}

export function normalizeDecimal(value: unknown, fallback: number = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeNullableDecimal(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isReceiptDraftInvalid(entry: Record<string, unknown> = {}): boolean {
  return normalizeReceiptQty(entry.received_qty) > Number(entry.max_receivable || 0);
}

export function isShortageDraftInvalid(entry: Record<string, unknown> = {}): boolean {
  return normalizeReceiptQty(entry.close_qty) > Number(entry.max_closable || 0);
}

export const buildSuggestionVariantLabel = (variantOptions: Record<string, unknown> = {}): string =>
  Object.values(variantOptions || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' / ');

export const buildSuggestionMeta = (suggestion: Record<string, unknown>): string => {
  const sku = String(suggestion?.sku || '').trim();
  const brand = String(suggestion?.brand || '').trim();
  return [sku || '-', brand || '-'].join(' · ');
};

export function getSuggestionOrderIds(suggestion: Record<string, unknown> = {}): string[] {
  const orderIds = Array.isArray(suggestion.order_ids) ? suggestion.order_ids : [];
  return [...new Set(orderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}
