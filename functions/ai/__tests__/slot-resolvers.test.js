import { describe, expect, it, vi } from 'vitest';
import {
  resolveSalespersonSlot,
  resolveOrderProductSlot,
  resolveOrderVariantSlot,
  resolvePurchaseOrderItemsSlot,
} from '../slot-resolvers.js';

describe('slot resolvers', () => {
  it('returns salesperson candidates when the name is ambiguous', async () => {
    const salespersonRepo = {
      list: vi.fn().mockResolvedValue({
        results: [
          { id: 'sp-1', name: '张三', store: '深圳店' },
          { id: 'sp-2', name: '张三', store: '广州店' },
        ],
      }),
    };

    const result = await resolveSalespersonSlot('张三', {}, { salespersonRepo });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'candidates',
        candidates: [
          expect.objectContaining({ value: 'sp-1', label: '张三', description: '深圳店' }),
          expect.objectContaining({ value: 'sp-2', label: '张三', description: '广州店' }),
        ],
      })
    );
  });

  it('resolves order productId when product name uniquely matches a product', async () => {
    const productRepo = {
      search: vi.fn().mockResolvedValue({
        items: [{ id: 'prod-1', name: '跑鞋' }],
        total: 1,
      }),
    };

    const result = await resolveOrderProductSlot('', { productName: '跑鞋' }, { productRepo });

    expect(productRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({
        search: '跑鞋',
        page: 1,
        limit: 5,
        status: 'active',
      })
    );
    expect(result).toBe('prod-1');
  });

  it('keeps original order productId when product search is ambiguous', async () => {
    const productRepo = {
      search: vi.fn().mockResolvedValue({
        items: [{ id: 'prod-1' }, { id: 'prod-2' }],
        total: 2,
      }),
    };

    const result = await resolveOrderProductSlot('', { productName: '跑鞋' }, { productRepo });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'candidates',
      })
    );
  });

  it('resolves order variantId from active variants using size and color hints', async () => {
    const variantRepo = {
      findByProductId: vi.fn().mockResolvedValue([
        {
          id: 'var-1',
          product_id: 'prod-1',
          status: 'active',
          sku: 'SKU-BLK-42',
          options_values: { 颜色: '黑色', 尺码: '42' },
        },
      ]),
    };

    const result = await resolveOrderVariantSlot('', {
      productId: 'prod-1',
      color: '黑色',
      size: '42',
    }, { variantRepo });

    expect(result).toBe('var-1');
  });

  it('returns variant candidates when multiple active variants match the same hints', async () => {
    const variantRepo = {
      findByProductId: vi.fn().mockResolvedValue([
        {
          id: 'var-1',
          product_id: 'prod-1',
          status: 'active',
          sku: 'SKU-BLK-42-A',
          options_values: { 颜色: '黑色', 尺码: '42' },
        },
        {
          id: 'var-2',
          product_id: 'prod-1',
          status: 'active',
          sku: 'SKU-BLK-42-B',
          options_values: { 颜色: '黑色', 尺码: '42' },
        },
      ]),
    };

    const result = await resolveOrderVariantSlot('', {
      productId: 'prod-1',
      color: '黑色',
      size: '42',
    }, { variantRepo });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'candidates',
        candidates: [
          expect.objectContaining({ value: 'var-1' }),
          expect.objectContaining({ value: 'var-2' }),
        ],
      })
    );
  });

  it('resolves purchase-order manual items when a variant query uniquely matches', async () => {
    const variantRepo = {
      searchForAI: vi.fn().mockResolvedValue({
        items: [{ id: 'var-1', product_id: 'prod-1', cost_price: 60 }],
        total: 1,
      }),
    };

    const result = await resolvePurchaseOrderItemsSlot(
      [{ variant_query: '跑鞋 黑色 42', quantity: 20 }],
      { variantRepo }
    );

    expect(result).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 20,
      }),
    ]);
  });
});
