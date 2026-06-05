import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  productFindById: vi.fn(),
  variantFindByIdAndProductId: vi.fn(),
  dimensionGetMap: vi.fn(),
}));

vi.mock('../../../repositories/ProductRepository.js', () => ({
  ProductRepository: vi.fn(() => ({
    findById: mocks.productFindById,
  })),
}));

vi.mock('../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: vi.fn(() => ({
    findByIdAndProductId: mocks.variantFindByIdAndProductId,
  })),
}));

vi.mock('../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: vi.fn(() => ({
    getDimensionMap: mocks.dimensionGetMap,
  })),
}));

import { validateProductVariantBinding } from '../validation.js';

describe('validateProductVariantBinding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'active' });
    mocks.variantFindByIdAndProductId.mockResolvedValue({ id: 'v-1', product_id: 'p-1', status: 'active' });
    mocks.dimensionGetMap.mockResolvedValue({});
  });

  it('rejects product without variant', async () => {
    await expect(validateProductVariantBinding({}, 'p-1', null)).rejects.toThrow('variantId is required when productId is provided');
  });

  it('rejects variant without product', async () => {
    await expect(validateProductVariantBinding({}, null, 'v-1')).rejects.toThrow('productId is required when variantId is provided');
  });

  it('rejects when product does not exist', async () => {
    mocks.productFindById.mockResolvedValue(null);
    await expect(validateProductVariantBinding({}, 'p-1', 'v-1')).rejects.toThrow('productId does not exist');
  });

  it('rejects when variant does not belong to product', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValue(null);
    await expect(validateProductVariantBinding({}, 'p-1', 'v-1')).rejects.toThrow('variantId does not belong to productId');
  });

  it('rejects archived variant when checkActive is true', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValue({ id: 'v-1', status: 'archived' });
    await expect(validateProductVariantBinding({}, 'p-1', 'v-1', { checkActive: true })).rejects.toThrow('variant must be active');
  });

  it('returns normalized binding when valid', async () => {
    const result = await validateProductVariantBinding({}, 'p-1', 'v-1', { checkActive: true });
    expect(result).toEqual(
      expect.objectContaining({
        product: expect.objectContaining({ id: 'p-1' }),
        variant: expect.objectContaining({ id: 'v-1' }),
        normalizedVariantId: 'v-1',
      })
    );
  });

  it('hydrates product dimension_map for downstream order snapshot consumers', async () => {
    mocks.dimensionGetMap.mockResolvedValue({
      'dim-color': 'Color',
      'dim-size': 'Size',
    });

    const result = await validateProductVariantBinding({}, 'p-1', 'v-1', { checkActive: true });

    expect(mocks.dimensionGetMap).toHaveBeenCalledWith('p-1');
    expect(result.product).toEqual(
      expect.objectContaining({
        id: 'p-1',
        dimension_map: {
          'dim-color': 'Color',
          'dim-size': 'Size',
        },
      })
    );
  });

  it('rejects out-of-stock variants when policy is in_stock_only', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
      available_quantity: 0,
    });

    await expect(
      validateProductVariantBinding({}, 'p-1', 'v-1', {
        checkActive: true,
        variantSelectPolicy: 'in_stock_only',
      })
    ).rejects.toThrow('variant must be in stock');
  });

  it('allows out-of-stock variants when policy allows preorders', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
      available_quantity: 0,
    });

    const result = await validateProductVariantBinding({}, 'p-1', 'v-1', {
      checkActive: true,
      variantSelectPolicy: 'allow_out_of_stock',
    });

    expect(result.normalizedVariantId).toBe('v-1');
  });
});
