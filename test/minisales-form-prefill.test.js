import { describe, expect, it } from 'vitest';
import { buildDuplicatePrefill } from '../minisales/miniprogram/pages/detail/controller.ts';
import { buildFormPrefillState } from '../minisales/miniprogram/pages/form/controller.ts';

describe('minisales sales form prefill', () => {
  it('preserves binding card image and variant summary when duplicating an order', () => {
    const prefill = buildDuplicatePrefill({
      currentData: {
        name: 'Tee',
        brand: 'ACME',
        series: 'S1',
        sku: 'SKU-1',
        size: 'Size: L',
        color: 'Red',
        material: 'Cotton',
        remark: 'rush',
        deadline: '2026-04-20',
      },
      quantity: 2,
      productId: 'p-1',
      variantId: 'v-1',
      header: {
        mainImage: 'main-img',
      },
      files: [],
    });

    const state = buildFormPrefillState({}, prefill);

    expect(state.boundProduct).toEqual(
      expect.objectContaining({
        productId: 'p-1',
        variantId: 'v-1',
        name: 'Tee',
        sku: 'SKU-1',
        primaryImage: 'main-img',
        variantLabel: 'Red / Cotton / Size: L',
      })
    );
  });
});
