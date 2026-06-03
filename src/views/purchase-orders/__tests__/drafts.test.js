import { describe, expect, it } from 'vitest';
import {
  buildSuggestionMeta,
  buildSuggestionVariantLabel,
  getSuggestionOrderIds,
  isReceiptDraftInvalid,
  isShortageDraftInvalid,
  normalizeDecimal,
  normalizeNullableDecimal,
  normalizeReceiptQty,
} from '../drafts';

describe('purchase order draft helpers', () => {
  it('normalizes receipt quantities into non-negative integers', () => {
    expect(normalizeReceiptQty(3.9)).toBe(3);
    expect(normalizeReceiptQty(-5)).toBe(0);
    expect(normalizeReceiptQty('2')).toBe(2);
    expect(normalizeReceiptQty('nope')).toBe(0);
  });

  it('normalizes decimals with fallback handling', () => {
    expect(normalizeDecimal('12.5')).toBe(12.5);
    expect(normalizeDecimal('bad', 7)).toBe(7);
    expect(normalizeDecimal(undefined)).toBe(0);
  });

  it('normalizes nullable decimals without forcing empty values to zero', () => {
    expect(normalizeNullableDecimal('3.25')).toBe(3.25);
    expect(normalizeNullableDecimal('')).toBeNull();
    expect(normalizeNullableDecimal(undefined)).toBeNull();
    expect(normalizeNullableDecimal('bad')).toBeNull();
  });

  it('detects receipt and shortage drafts that exceed allowed quantities', () => {
    expect(isReceiptDraftInvalid({ received_qty: 6, max_receivable: 5 })).toBe(true);
    expect(isReceiptDraftInvalid({ received_qty: 5, max_receivable: 5 })).toBe(false);

    expect(isShortageDraftInvalid({ close_qty: 4, max_closable: 3 })).toBe(true);
    expect(isShortageDraftInvalid({ close_qty: 3, max_closable: 3 })).toBe(false);
  });

  it('builds suggestion labels and meta with trimmed fallback values', () => {
    expect(buildSuggestionVariantLabel({ color: ' 黑色 ', size: 'L', empty: '' })).toBe('黑色 / L');
    expect(buildSuggestionVariantLabel()).toBe('');

    expect(buildSuggestionMeta({ sku: ' SKU-1 ', brand: ' ACME ' })).toBe('SKU-1 · ACME');
    expect(buildSuggestionMeta({ sku: '', brand: '' })).toBe('- · -');
  });

  it('deduplicates truthy order ids while preserving their original order', () => {
    expect(
      getSuggestionOrderIds({
        order_ids: ['o-1', '', 'o-2', 'o-1', null, 'o-3'],
      })
    ).toEqual(['o-1', 'o-2', 'o-3']);

    expect(getSuggestionOrderIds()).toEqual([]);
  });
});
