import { describe, expect, it } from 'vitest';
import { buildVariantPayload } from '../minisales/miniprogram/components/sales/product-binding/payload.ts';

describe('minisales product binding payload', () => {
  it('maps color and material by dimension labels instead of raw option keys', () => {
    const payload = buildVariantPayload(
      {
        id: 'p-1',
        name: 'Tee',
        brand: 'ACME',
        series: 'S1',
        primaryImage: 'prod-img',
        dimensionMap: {
          'dim-color': 'Color',
          'dim-material': '材质',
          'dim-size': 'Size',
        },
      },
      {
        id: 'v-1',
        sku: 'SKU-1',
        displayName: 'Red / Cotton / L',
        primaryImage: 'variant-img',
        optionsValues: {
          'dim-color': 'Red',
          'dim-material': 'Cotton',
          'dim-size': 'L',
        },
      }
    );

    expect(payload).toEqual({
      productId: 'p-1',
      variantId: 'v-1',
      name: 'Tee',
      brand: 'ACME',
      series: 'S1',
      sku: 'SKU-1',
      size: 'Size: L',
      color: 'Red',
      material: 'Cotton',
      variantLabel: 'Red / Cotton / L',
      primaryImage: 'variant-img',
    });
  });

  it('falls back to raw option keys when no dimension map is present', () => {
    const payload = buildVariantPayload(
      {
        id: 'p-2',
        name: 'Bag',
        brand: 'ACME',
        series: '',
        primaryImage: 'prod-img',
      },
      {
        id: 'v-2',
        sku: 'SKU-2',
        displayName: 'Black / XL',
        primaryImage: '',
        optionsValues: {
          color: 'Black',
          size: 'XL',
        },
      }
    );

    expect(payload.color).toBe('Black');
    expect(payload.material).toBe('');
    expect(payload.size).toBe('size: XL');
    expect(payload.primaryImage).toBe('prod-img');
  });
});
