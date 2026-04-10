import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('minisales product binding component', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.Component = vi.fn((options) => options);
  });

  it('maps bound color and material from dimension labels when selecting a variant', async () => {
    await import('../minisales/miniprogram/components/sales/product-binding/index.ts');
    const config = globalThis.Component.mock.calls[0][0];

    const triggerEvent = vi.fn();
    const closePicker = vi.fn();
    const ctx = {
      data: {
        productDetail: {
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
        variants: [
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
          },
        ],
      },
      triggerEvent,
      closePicker,
    };

    config.methods.selectVariant.call(ctx, {
      currentTarget: {
        dataset: { id: 'v-1' },
      },
    });

    expect(triggerEvent).toHaveBeenCalledWith('change', {
      value: expect.objectContaining({
        productId: 'p-1',
        variantId: 'v-1',
        color: 'Red',
        material: 'Cotton',
        size: 'Size: L',
      }),
    });
  });
});
