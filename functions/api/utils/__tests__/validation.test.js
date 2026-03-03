import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  productFindById: vi.fn(),
  variantFindByIdAndProductId: vi.fn(),
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

import { validateProductVariantBinding } from '../validation.js';

describe('validateProductVariantBinding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'active' });
    mocks.variantFindByIdAndProductId.mockResolvedValue({ id: 'v-1', product_id: 'p-1', status: 'active' });
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

  it('rejects archived records when checkActive is true', async () => {
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'archived' });
    await expect(validateProductVariantBinding({}, 'p-1', 'v-1', { checkActive: true })).rejects.toThrow('product must be active');
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
});
