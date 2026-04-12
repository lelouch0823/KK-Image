import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  findVariantsByProductId: vi.fn(),
  getDimensionMap: vi.fn(),
}));

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: vi.fn(() => ({
    search: mocks.search,
  })),
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: vi.fn(() => ({
    findByProductId: mocks.findVariantsByProductId,
  })),
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: vi.fn(() => ({
    getDimensionMap: mocks.getDimensionMap,
  })),
}));

import exportRoute from '../export.js';

const createApp = () => {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/products/export', exportRoute);
  return app;
};

describe('manage product export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.search.mockResolvedValue({
      items: [
        {
          id: 'prod-1',
          name: 'Desk',
          spu: 'SPU-1',
          product_code: 'P-1',
          category: 'Furniture',
          brand: 'ACME',
          series: 'Series A',
          currency: 'CNY',
          status: 'active',
          description: 'Desk Desc',
          created_at: 1700000000000,
          updated_at: 1700003600000,
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    mocks.findVariantsByProductId.mockResolvedValue([
      {
        id: 'var-1',
        sku: 'SKU-1',
        variant_code: 'V-1',
        options_values: { dim_color: 'Black' },
        price: 199,
        cost_price: 120,
        stock_quantity: 5,
        available_quantity: 5,
        status: 'active',
        created_at: 1700000000000,
        updated_at: 1700003600000,
      },
      {
        id: 'var-archived',
        sku: 'SKU-ARCHIVED',
        variant_code: 'V-ARCHIVED',
        options_values: { dim_color: 'Grey' },
        price: 99,
        cost_price: 80,
        stock_quantity: 6,
        available_quantity: 6,
        status: 'archived',
        created_at: 1700000000000,
        updated_at: 1700003600000,
      },
      {
        id: 'var-oos',
        sku: 'SKU-OOS',
        variant_code: 'V-OOS',
        options_values: { dim_color: 'White' },
        price: 189,
        cost_price: 110,
        stock_quantity: 0,
        available_quantity: 0,
        status: 'active',
        created_at: 1700000000000,
        updated_at: 1700003600000,
      },
    ]);
    mocks.getDimensionMap.mockResolvedValue({ dim_color: '颜色' });
  });

  it('forwards export filters and returns variant-level csv columns', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/export?format=csv&search=desk&status=active&brand=ACME&category=Furniture&hasStock=in_stock&sortBy=stock&sortOrder=asc',
      { method: 'GET' },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(mocks.search).toHaveBeenCalledWith({
      search: 'desk',
      status: 'active',
      brand: 'ACME',
      category: 'Furniture',
      hasStock: 'in_stock',
      sortBy: 'stock',
      sortOrder: 'asc',
      page: 1,
      limit: 100,
    });

    const csv = await res.text();
    expect(csv).toContain('Variant ID');
    expect(csv).toContain('SKU-1');
    expect(csv).toContain(',Black,,');
    expect(csv).not.toContain('SKU-ARCHIVED');
    expect(csv).not.toContain('SKU-OOS');
  });

  it('returns a non-200 response when export generation fails', async () => {
    mocks.search.mockRejectedValueOnce(new Error('db exploded'));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/export?format=csv',
      { method: 'GET' },
      { DB: {} }
    );

    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error).toContain('db exploded');
  });
});
