import { describe, expect, it } from 'vitest';
import {
  normalizeSalesProductDetail,
  normalizeSalesProductSummary,
} from '../../../miniprogram/utils/normalize/product';

describe('product normalizers', () => {
  it('normalizes product summaries into a stable list-card shape', () => {
    const summary = normalizeSalesProductSummary({
      id: 'p-1',
      name: 'Chair',
      brand: 'ACME',
      images: ['/file/a.png'],
      primaryImage: '/file/a.png',
    });

    expect(summary).toEqual(
      expect.objectContaining({
        id: 'p-1',
        name: 'Chair',
        primaryImage: '/file/a.png',
      })
    );
  });

  it('normalizes product detail variants and parses option maps', () => {
    const detail = normalizeSalesProductDetail({
      id: 'p-1',
      name: 'Chair',
      dimension_map: { color: '颜色' },
      dimensions: [{ id: 'color', name: '颜色', values: [{ value: '黑色' }] }],
      variants: [
        {
          id: 'v-1',
          status: 'active',
          primaryImage: 'img-1',
          options_values: '{"color":"黑色"}',
          available_quantity: 3,
          replenishment_quantity: 2,
          replenishment_po_count: 1,
        },
      ],
    });

    expect(detail.dimensionMap).toEqual({ color: '颜色' });
    expect(detail.variants[0]).toEqual(
      expect.objectContaining({
        id: 'v-1',
        optionsValues: { color: '黑色' },
        availableQuantity: 3,
        replenishmentQuantity: 2,
        replenishmentPoCount: 1,
        primaryImage: '/file/img-1',
      })
    );
  });
});
