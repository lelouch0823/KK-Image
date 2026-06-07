import { describe, expect, it } from 'vitest';
import {
  reconcileVariantSelection,
  countUnavailableSelectedVariants,
} from '../purchase-order-variant-selection.js';

describe('purchase-order variant selection', () => {
  it('reconciles add/remove by variant_id and keeps pre-order items untouched', () => {
    const currentItems = [
      { id: 'poi-1', variant_id: 'var-a', pre_order_id: null },
      { id: 'poi-2', variant_id: 'var-b', pre_order_id: null },
      { id: 'poi-3', variant_id: 'var-x', pre_order_id: 'ord-1' },
    ];

    const selectedVariants = [
      {
        variant_id: 'var-b',
        product_id: 'prod-1',
        product_name: 'P1',
        sku: 'SKU-B',
        brand: 'B',
        unit_cost: 20,
      },
      {
        variant_id: 'var-c',
        product_id: 'prod-2',
        product_name: 'P2',
        sku: 'SKU-C',
        brand: 'C',
        unit_cost: 30,
      },
    ];

    const result = reconcileVariantSelection({ currentItems, selectedVariants });

    expect(result.toRemoveItemIds).toEqual(['poi-1']);
    expect(result.toRemoveVariantIds).toEqual(['var-a']);
    expect(result.toAdd).toEqual([
      expect.objectContaining({
        variant_id: 'var-c',
        product_id: 'prod-2',
      }),
    ]);
  });

  it('counts selected variants that are no longer active/available', () => {
    const initialSelectedVariantIds = ['var-a', 'var-b', 'var-c'];
    const activeVariants = [{ variant_id: 'var-a' }, { variant_id: 'var-c' }];

    expect(countUnavailableSelectedVariants(initialSelectedVariantIds, activeVariants)).toBe(1);
  });
});
