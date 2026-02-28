import { describe, it, expect, vi } from 'vitest';
import { executeAITool } from '../ai-tool-executor.js';

describe('executeAITool - variant aware tools', () => {
  it('searchVariants uses variant repo and enforces limit cap', async () => {
    const searchForAI = vi.fn().mockResolvedValue([{ id: 'v1' }]);
    const result = await executeAITool(
      'searchVariants',
      {
        search: 'red',
        brand: 'ACME',
        category: 'Shoes',
        status: 'active',
        limit: 99,
      },
      {
        variantRepo: { searchForAI },
      }
    );

    expect(searchForAI).toHaveBeenCalledWith({
      search: 'red',
      brand: 'ACME',
      category: 'Shoes',
      status: 'active',
      limit: 20,
    });
    expect(result).toEqual([{ id: 'v1' }]);
  });

  it('getVariantDetail returns variant + product snapshot', async () => {
    const variantRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'var-1',
        product_id: 'prod-1',
        options_values: { Color: 'Red', Size: '42' },
        stock_quantity: 5,
      }),
    };
    const productRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Sneaker',
        brand: 'ACME',
        spu: 'SPU-1',
      }),
    };

    const result = await executeAITool('getVariantDetail', { id: 'var-1' }, { variantRepo, productRepo });

    expect(variantRepo.findById).toHaveBeenCalledWith('var-1');
    expect(productRepo.findById).toHaveBeenCalledWith('prod-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'var-1',
        product: {
          id: 'prod-1',
          name: 'Sneaker',
          brand: 'ACME',
          spu: 'SPU-1',
        },
      })
    );
  });

  it('getProductDetail includes variants when variant repo is available', async () => {
    const productRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Sneaker',
      }),
    };
    const variantRepo = {
      findByProductId: vi.fn().mockResolvedValue([
        { id: 'v1', product_id: 'prod-1' },
        { id: 'v2', product_id: 'prod-1' },
      ]),
    };

    const result = await executeAITool('getProductDetail', { id: 'prod-1' }, { productRepo, variantRepo });

    expect(variantRepo.findByProductId).toHaveBeenCalledWith('prod-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'prod-1',
        variants: expect.arrayContaining([expect.objectContaining({ id: 'v1' })]),
      })
    );
  });
});
