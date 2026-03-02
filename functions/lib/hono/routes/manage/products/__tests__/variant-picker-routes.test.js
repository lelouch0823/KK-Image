import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsApp from '../index.js';

vi.mock('../../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
  invalidateCache: vi.fn(),
  getProductCacheUrls: vi.fn(() => []),
}));

function createApp() {
  const app = new Hono();
  app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
  app.route('/api/manage/products', productsApp);
  return app;
}

describe('Product routes - variant picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /variants returns active variants for picker and parses options', async () => {
    const all = vi
      .fn()
      .mockResolvedValueOnce({ results: [{ total: 2 }] })
      .mockResolvedValueOnce({
        results: [
          {
            variant_id: 'var-1',
            product_id: 'prod-1',
            product_name: 'Sneaker',
            brand: 'ACME',
            spu: 'SPU-1',
            product_images: '["img-1"]',
            variant_sku: 'SKU-1',
            variant_code: 'V0001',
            variant_options: '{"Color":"Red","Size":"42"}',
            unit_cost: 88,
            stock_quantity: 5,
          },
        ],
      });

    const bind = vi.fn(() => ({ all }));
    const prepare = vi.fn(() => ({ bind }));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/variants?search=red&page=1&limit=20',
      {},
      { DB: { prepare } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        variant_id: 'var-1',
        product_name: 'Sneaker',
        sku: 'SKU-1',
        variant_options: { Color: 'Red', Size: '42' },
      })
    );
    expect(prepare).toHaveBeenCalledTimes(2);
  });
});
