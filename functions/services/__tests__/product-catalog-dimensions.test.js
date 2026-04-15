import { describe, expect, it, vi } from 'vitest';
import { syncProductCatalogDimensions } from '../product-catalog/dimensions.js';

describe('syncProductCatalogDimensions', () => {
  it('reuses an existing active dimension by name when the payload omits dimension ids', async () => {
    const updateDimension = vi.fn(async (_productId, dimensionId, payload) => ({
      id: dimensionId,
      name: payload.name,
      sort_order: payload.sort_order,
      status: 'active',
    }));
    const createDimension = vi.fn();
    const listByProduct = vi.fn()
      .mockResolvedValueOnce([
        {
          id: 'dim-color',
          name: 'Color',
          status: 'active',
          values: [
            { id: 'val-red', value: 'Red', status: 'active', meta: null },
            { id: 'val-blue', value: 'Blue', status: 'active', meta: null },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'dim-color',
          name: 'Color',
          status: 'active',
          values: [
            { id: 'val-red', value: 'Red', status: 'active', meta: null },
            { id: 'val-blue', value: 'Blue', status: 'active', meta: null },
          ],
        },
      ]);
    const dimensionRepo = {
      listByProduct,
      updateDimension,
      createDimension,
      addValue: vi.fn(),
      updateValueMeta: vi.fn(),
      archiveValue: vi.fn(),
      archiveDimension: vi.fn(),
    };

    const result = await syncProductCatalogDimensions({
      productId: 'prod-1',
      incomingDimensions: [
        {
          name: ' Color ',
          values: ['Red', 'Blue'],
        },
      ],
      replaceMissing: true,
      dimensionRepo,
    });

    expect(updateDimension).toHaveBeenCalledWith('prod-1', 'dim-color', {
      name: 'Color',
      sort_order: 0,
    });
    expect(createDimension).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dim-color');
  });
});
