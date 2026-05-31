import { describe, expect, it } from 'vitest';
import {
  buildCreatePurchaseItemsPayload,
  getExcludeOrderIds,
  getExistingBrands,
  getSelectedVariantIdsForPicker,
  getShortageItems,
  getTotalCreateQty,
} from '../purchase-orders/create-flow';

describe('purchase-order create-flow helpers', () => {
  it('derives picker ids and summary metrics from create items', () => {
    const items = [
      { quantity: 3, required_quantity: 5, pre_order_id: 'order-1', variant_id: 'variant-1', brand: 'ACME' },
      { quantity: 2, required_quantity: 2, pre_order_id: null, variant_id: 'variant-2', brand: 'ACME' },
      { quantity: 1, required_quantity: 4, pre_order_id: null, variant_id: 'variant-3', brand: 'Globex' },
    ];

    expect(getTotalCreateQty(items)).toBe(6);
    expect(getShortageItems(items)).toEqual([items[0], items[2]]);
    expect(getExcludeOrderIds(items)).toEqual(['order-1']);
    expect(getSelectedVariantIdsForPicker(items)).toEqual(['variant-2', 'variant-3']);
    expect(getExistingBrands(items)).toEqual(['ACME', 'Globex']);
  });

  it('builds create payload items with normalized fallback values', () => {
    expect(buildCreatePurchaseItemsPayload([
      { product_id: 'product-1', variant_id: 'variant-1', pre_order_id: 'order-1', quantity: 3, unit_cost: 20 },
      { product_id: 'product-2', variant_id: 'variant-2', quantity: 0, unit_cost: null },
    ])).toEqual([
      { product_id: 'product-1', variant_id: 'variant-1', pre_order_id: 'order-1', quantity: 3, unit_cost: 20 },
      { product_id: 'product-2', variant_id: 'variant-2', pre_order_id: null, quantity: 1, unit_cost: 0 },
    ]);
  });
});
