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

export function isReceiptDraftInvalid(entry: Record<string, any> = {}): boolean {
  return normalizeReceiptQty(entry.received_qty) > Number(entry.max_receivable || 0);
}

export function isShortageDraftInvalid(entry: Record<string, any> = {}): boolean {
  return normalizeReceiptQty(entry.close_qty) > Number(entry.max_closable || 0);
}

export const buildSuggestionVariantLabel = (variantOptions: Record<string, any> = {}): string =>
  Object.values(variantOptions || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' / ');

export const buildSuggestionMeta = (suggestion: any): string => {
  const sku = String(suggestion?.sku || '').trim();
  const brand = String(suggestion?.brand || '').trim();
  return [sku || '—', brand || '-'].join(' · ');
};

export function getSuggestionOrderIds(suggestion: Record<string, any> = {}): string[] {
  return [...new Set((suggestion.order_ids || []).filter(Boolean))] as string[];
}
