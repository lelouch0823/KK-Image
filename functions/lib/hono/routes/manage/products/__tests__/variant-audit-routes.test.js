import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productByIdApp from '../[id].js';

const mockProductRepo = {
  findById: vi.fn(),
  updateWithMeta: vi.fn(),
};
const mockVariantRepo = {
  syncVariants: vi.fn(),
  findByProductId: vi.fn(),
};
const mockAuditRepo = {
  createBatch: vi.fn(),
};
const mockVariantImageRepo = {
  syncImages: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    findById(...args) { return mockProductRepo.findById(...args); }
    updateWithMeta(...args) { return mockProductRepo.updateWithMeta(...args); }
  },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: class {
    syncVariants(...args) { return mockVariantRepo.syncVariants(...args); }
    findByProductId(...args) { return mockVariantRepo.findByProductId(...args); }
    buildAuditEvents(...args) {
      return [
        { variant_id: 'v1', product_id: 'p1', action: 'variant_updated', changes: { before: { price: 10 }, after: { price: 12 } } },
      ];
    }
  },
}));

vi.mock('../../../../../../repositories/VariantAuditRepository.js', () => ({
  VariantAuditRepository: class {
    createBatch(...args) { return mockAuditRepo.createBatch(...args); }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    syncImages(...args) { return mockVariantImageRepo.syncImages(...args); }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    listByProduct = vi.fn().mockResolvedValue([]);
    syncDimensions = vi.fn().mockResolvedValue();
  },
}));

vi.mock('../../../../middleware/cache.js', () => ({
  invalidateCache: vi.fn(async () => {}),
}));

function createApp() {
  const app = new Hono();
  app.onError((err, c) => {
    console.error('onError caught:', err);
    return c.json({ success: false, error: err.message }, err.statusCode || 500);
  });
  app.route('/api/manage/products', productByIdApp);
  return app;
}

describe('product variant audit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditRepo.createBatch.mockResolvedValue();
  });

  it('PATCH /:id writes audit logs for variant changes', async () => {
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }])
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 12 }]);
    mockVariantRepo.syncVariants.mockResolvedValue();

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tee',
          variants: [{ id: 'v1', price: 12, cost_price: 6, stock_quantity: 5, alert_threshold: 1, status: 'active' }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockAuditRepo.createBatch).toHaveBeenCalledTimes(1);
  });

  it('DELETE /:id writes archived audit logs for existing variants', async () => {
    mockProductRepo.findById.mockResolvedValue({ id: 'p1' });
    mockVariantRepo.findByProductId.mockResolvedValue([{ id: 'v1', product_id: 'p1', status: 'active' }]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      { method: 'DELETE' },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ run: vi.fn(async () => ({ meta: { changes: 1 } })) })),
          })),
        },
        executionCtx: { waitUntil: vi.fn() },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockAuditRepo.createBatch).toHaveBeenCalledTimes(1);
  });

  it('PATCH /:id syncs images for newly created variant without id', async () => {
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.syncVariants.mockResolvedValue();
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([{ id: 'v-legacy', product_id: 'p1', sku: 'SKU-OLD', options_values: { Color: 'Blue' } }])
      .mockResolvedValueOnce([
        { id: 'v-legacy', product_id: 'p1', sku: 'SKU-OLD', options_values: { Color: 'Blue' } },
        { id: 'v-new', product_id: 'p1', sku: 'SKU-AUTO', options_values: { Color: 'Red' } },
      ]);
    mockVariantImageRepo.syncImages.mockResolvedValue();

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tee',
          variants: [
            { id: 'v-legacy', price: 10, cost_price: 6, stock_quantity: 5, alert_threshold: 1, status: 'active', options_values: { Color: 'Blue' } },
            { price: 12, cost_price: 7, stock_quantity: 4, alert_threshold: 1, status: 'active', options_values: { Color: 'Red' }, images: [{ image_id: 'img-new', is_primary: 1 }] },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockVariantImageRepo.syncImages).toHaveBeenCalledWith(
      'p1',
      'v-new',
      [{ image_id: 'img-new', is_primary: 1 }]
    );
  });
});
