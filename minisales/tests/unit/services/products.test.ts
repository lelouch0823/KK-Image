import { describe, expect, it, vi } from 'vitest';
import {
  loadProductDetail,
  loadProductList,
  pickSelectableVariants,
} from '../../../miniprogram/services/sales/products';

describe('sales products service', () => {
  it('loads product list with search pagination and normalizes payload meta', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'p-1',
          name: 'Chair',
          brand: 'ACME',
          images: ['/file/a.png'],
          primaryImage: '/file/a.png',
        },
      ],
      error: null,
      code: null,
      status: 200,
      detail: null,
      payload: {
        success: true,
        meta: { total: 12, page: 2, limit: 6 },
      },
    });

    const result = await loadProductList(
      { accessToken: 'sales-token', page: 2, limit: 6, search: 'chair' },
      request
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/products?search=chair&page=2&limit=6',
        method: 'GET',
      })
    );
    expect(result.data).toEqual({
      items: [
        expect.objectContaining({
          id: 'p-1',
          name: 'Chair',
          primaryImage: '/file/a.png',
        }),
      ],
      meta: { total: 12, page: 2, limit: 6 },
    });
  });

  it('loads product detail and exposes selectable variants with in-stock sales semantics', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'p-1',
        name: 'Chair',
        dimension_map: { color: '颜色' },
        variants: [
          {
            id: 'v-1',
            status: 'active',
            available_quantity: 3,
            options_values: { color: '黑色' },
          },
          {
            id: 'v-2',
            status: 'active',
            available_quantity: 0,
            options_values: { color: '白色' },
          },
          {
            id: 'v-3',
            status: 'archived',
            available_quantity: 8,
            options_values: { color: '灰色' },
          },
        ],
      },
      error: null,
      code: null,
      status: 200,
      detail: null,
      payload: { success: true },
    });

    const result = await loadProductDetail(
      { accessToken: 'sales-token', productId: 'p-1' },
      request
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/products/p-1',
        method: 'GET',
      })
    );
    expect(pickSelectableVariants(result.data)).toEqual([
      expect.objectContaining({ id: 'v-1' }),
    ]);
  });
});
