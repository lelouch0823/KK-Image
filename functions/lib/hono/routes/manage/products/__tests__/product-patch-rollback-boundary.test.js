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
  listByVariant: vi.fn(),
};
const mockDimensionRepo = {
  listByProduct: vi.fn(),
  updateDimension: vi.fn(),
  createDimension: vi.fn(),
  addValue: vi.fn(),
  restoreSnapshot: vi.fn(),
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
    buildAuditEvents() { return []; }
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
    listByVariant(...args) { return mockVariantImageRepo.listByVariant(...args); }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    listByProduct(...args) { return mockDimensionRepo.listByProduct(...args); }
    updateDimension(...args) { return mockDimensionRepo.updateDimension(...args); }
    createDimension(...args) { return mockDimensionRepo.createDimension(...args); }
    addValue(...args) { return mockDimensionRepo.addValue(...args); }
    restoreSnapshot(...args) { return mockDimensionRepo.restoreSnapshot(...args); }
  },
}));

vi.mock('../../../../middleware/cache.js', () => ({
  invalidateCache: vi.fn(),
  getProductCacheUrls: vi.fn(() => []),
}));

function createApp() {
  const app = new Hono();
  app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
  app.use('/api/manage/products/*', async (c, next) => {
    c.set('user', { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
    await next();
  });
  app.route('/api/manage/products', productByIdApp);
  return app;
}

describe('product patch rollback boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductRepo.findById.mockResolvedValue({
      id: 'p1',
      name: 'Tee',
      brand: 'Old Brand',
      category: 'Tops',
      currency: 'CNY',
      images: [],
      specifications: {},
      options: [],
    });
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockDimensionRepo.listByProduct.mockResolvedValue([]);
    mockDimensionRepo.updateDimension.mockImplementation(async (_productId, dimensionId, payload) => ({
      id: dimensionId,
      product_id: 'p1',
      name: payload.name,
      sort_order: payload.sort_order ?? 0,
    }));
    mockDimensionRepo.createDimension.mockImplementation(async (_productId, payload) => ({
      id: 'dim-new',
      product_id: 'p1',
      name: payload.name,
      sort_order: payload.sort_order ?? 0,
    }));
    mockDimensionRepo.addValue.mockResolvedValue({ id: 'val-new' });
    mockDimensionRepo.restoreSnapshot.mockResolvedValue(undefined);
    mockVariantImageRepo.listByVariant.mockResolvedValue([]);
    mockVariantImageRepo.syncImages.mockResolvedValue(undefined);
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([
        {
          id: 'v-existing',
          product_id: 'p1',
          sku: 'SKU-OLD',
          price: 10,
          cost_price: 5,
          stock_quantity: 99,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Blue' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'v-new',
          product_id: 'p1',
          sku: '',
          price: 12,
          cost_price: 6,
          stock_quantity: 4,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Red' },
        },
        {
          id: 'v-shadow',
          product_id: 'p1',
          sku: '',
          price: 13,
          cost_price: 6,
          stock_quantity: 7,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Red' },
        },
      ]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 1,
      updatedCount: 0,
      archivedCount: 0,
      reactivatedCount: 0,
    });
  });

  it('does not replay stale stock snapshots when patch fails after variant sync', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: [
            {
              price: 12,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Red' },
              images: [{ image_id: 'img-red', is_primary: 1 }],
            },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mockVariantRepo.syncVariants).toHaveBeenCalledTimes(2);
    expect(mockVariantRepo.syncVariants).toHaveBeenLastCalledWith(
      'p1',
      expect.not.arrayContaining([
        expect.objectContaining({
          id: 'v-existing',
          stock_quantity: 99,
        }),
      ])
    );
  });

  it('rolls back product fields and dimensions when image sync fails after variant sync', async () => {
    mockDimensionRepo.listByProduct.mockResolvedValue([
      {
        id: 'dim-color',
        product_id: 'p1',
        name: 'Color',
        values: [{ id: 'val-blue', value: 'Blue', status: 'active' }],
        aliases: [],
      },
    ]);
    mockVariantRepo.findByProductId
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: 'v-existing',
          product_id: 'p1',
          sku: 'SKU-OLD',
          price: 10,
          cost_price: 5,
          stock_quantity: 3,
          alert_threshold: 1,
          status: 'active',
          options_values: { 'dim-color': 'Blue' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'v-existing',
          product_id: 'p1',
          sku: 'SKU-OLD',
          price: 12,
          cost_price: 6,
          stock_quantity: 3,
          alert_threshold: 1,
          status: 'active',
          options_values: { 'dim-color': 'Blue' },
        },
      ]);
    mockVariantRepo.syncVariants
      .mockReset()
      .mockResolvedValueOnce({
        createdCount: 0,
        updatedCount: 1,
        archivedCount: 0,
        reactivatedCount: 0,
      })
      .mockResolvedValueOnce({
        createdCount: 0,
        updatedCount: 1,
        archivedCount: 0,
        reactivatedCount: 0,
      });
    mockVariantImageRepo.syncImages.mockRejectedValueOnce(new Error('image sync failed'));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Tee',
          dimensions: [
            {
              id: 'dim-color',
              name: 'Color',
              values: ['Blue'],
            },
          ],
          variants: [
            {
              id: 'v-existing',
              sku: 'SKU-OLD',
              price: 12,
              cost_price: 6,
              stock_quantity: 3,
              alert_threshold: 1,
              status: 'active',
              options_values: { 'dim-color': 'Blue' },
              images: [{ image_id: 'img-new', is_primary: 1 }],
            },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(500);
    expect(mockProductRepo.updateWithMeta).toHaveBeenCalledTimes(2);
    expect(mockProductRepo.updateWithMeta).toHaveBeenLastCalledWith(
      'p1',
      expect.objectContaining({
        name: 'Tee',
        brand: 'Old Brand',
        category: 'Tops',
        currency: 'CNY',
      })
    );
    expect(mockDimensionRepo.restoreSnapshot).toHaveBeenCalledWith(
      'p1',
      [
        expect.objectContaining({
          id: 'dim-color',
          name: 'Color',
        }),
      ]
    );
  });

  it('restores variant image snapshots when image sync fails mid-patch', async () => {
    mockVariantRepo.findByProductId
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: 'v-existing',
          product_id: 'p1',
          sku: 'SKU-OLD',
          price: 10,
          cost_price: 5,
          stock_quantity: 3,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Blue' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'v-existing',
          product_id: 'p1',
          sku: 'SKU-OLD',
          price: 12,
          cost_price: 6,
          stock_quantity: 3,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Blue' },
        },
      ]);
    mockVariantRepo.syncVariants
      .mockReset()
      .mockResolvedValueOnce({
        createdCount: 0,
        updatedCount: 1,
        archivedCount: 0,
        reactivatedCount: 0,
      })
      .mockResolvedValueOnce({
        createdCount: 0,
        updatedCount: 1,
        archivedCount: 0,
        reactivatedCount: 0,
      });
    mockVariantImageRepo.listByVariant.mockResolvedValue([
      { image_id: 'img-old', is_primary: 1, sort_order: 0 },
    ]);
    mockVariantImageRepo.syncImages
      .mockRejectedValueOnce(new Error('image sync failed'))
      .mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: [
            {
              id: 'v-existing',
              sku: 'SKU-OLD',
              price: 12,
              cost_price: 6,
              stock_quantity: 3,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Blue' },
              images: [{ image_id: 'img-new', is_primary: 1 }],
            },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(500);
    expect(mockVariantImageRepo.syncImages).toHaveBeenCalledTimes(2);
    expect(mockVariantImageRepo.syncImages).toHaveBeenNthCalledWith(
      2,
      'p1',
      'v-existing',
      [{ image_id: 'img-old', is_primary: 1, sort_order: 0 }]
    );
  });
});
