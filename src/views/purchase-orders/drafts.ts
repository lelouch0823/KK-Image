// 从 utils 重新导出，保持向后兼容
export { normalizeReceiptQty, normalizeDecimal, normalizeNullableDecimal } from '@/utils/purchase-order-constraints';
export { getSuggestionOrderIds } from '@/utils/purchase-order-request';

import { normalizeReceiptQty } from '@/utils/purchase-order-constraints';

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
