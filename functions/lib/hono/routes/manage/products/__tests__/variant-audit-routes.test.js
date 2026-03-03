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
const mockDimensionRepo = {
  listByProduct: vi.fn(),
  createDimension: vi.fn(),
  updateDimension: vi.fn(),
  addValue: vi.fn(),
  updateValueMeta: vi.fn(),
};
const mockFolderUtils = {
  ensureVariantFolder: vi.fn(),
  moveFilesToFolder: vi.fn(),
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
    listByProduct(...args) { return mockDimensionRepo.listByProduct(...args); }
    createDimension(...args) { return mockDimensionRepo.createDimension(...args); }
    updateDimension(...args) { return mockDimensionRepo.updateDimension(...args); }
    addValue(...args) { return mockDimensionRepo.addValue(...args); }
    updateValueMeta(...args) { return mockDimensionRepo.updateValueMeta(...args); }
  },
}));

vi.mock('../../../../../../api/utils/folder-utils.js', () => ({
  ensureVariantFolder: (...args) => mockFolderUtils.ensureVariantFolder(...args),
  moveFilesToFolder: (...args) => mockFolderUtils.moveFilesToFolder(...args),
}));

vi.mock('../../../../middleware/cache.js', () => ({
  invalidateCache: vi.fn(async () => {}),
  getProductCacheUrls: vi.fn(() => []),
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
    mockDimensionRepo.listByProduct.mockResolvedValue([]);
    mockDimensionRepo.createDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });
    mockDimensionRepo.updateDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });
    mockDimensionRepo.addValue.mockResolvedValue({ id: 'val-red', value: 'Red' });
    mockDimensionRepo.updateValueMeta.mockResolvedValue();
    mockFolderUtils.ensureVariantFolder.mockResolvedValue('folder-variant');
    mockFolderUtils.moveFilesToFolder.mockResolvedValue(undefined);
  });

  it('PATCH /:id writes audit logs for variant changes', async () => {
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }])
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 12 }]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 0,
      updatedCount: 1,
      archivedCount: 0,
      reactivatedCount: 0,
    });

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
    const body = await res.json();
    expect(body.variantSync).toEqual({
      created: 0,
      updated: 1,
      archived: 0,
      reactivated: 0,
    });
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
    expect(mockFolderUtils.ensureVariantFolder).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      'v-new'
    );
    expect(mockFolderUtils.moveFilesToFolder).toHaveBeenCalledWith(
      expect.anything(),
      ['img-new'],
      'folder-variant'
    );
  });

  it('PATCH /:id rejects invalid currency before repository update', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: 'INVALID',
          variants: [{ id: 'v1', price: 12, cost_price: 6, stock_quantity: 5, alert_threshold: 1, status: 'active' }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
  });

  it('PATCH /:id maps duplicate variant signature error to 400', async () => {
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.findByProductId.mockResolvedValue([]);
    mockVariantRepo.syncVariants.mockRejectedValueOnce(new Error('duplicate variant signature in payload'));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tee',
          variants: [{ price: 12, cost_price: 6, stock_quantity: 5, alert_threshold: 1, status: 'active', options_values: { color: 'red' } }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duplicate variant signature/i);
  });

  it('PATCH /:id supports variants-only payload without product field updates', async () => {
    mockProductRepo.findById.mockResolvedValue({ id: 'p1', name: 'Tee' });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }])
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 12 }]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 0,
      updatedCount: 1,
      archivedCount: 0,
      reactivatedCount: 0,
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: [{ id: 'v1', price: 12, cost_price: 6, stock_quantity: 5, alert_threshold: 1, status: 'active' }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
    expect(mockProductRepo.findById).toHaveBeenCalledWith('p1');
  });

  it('PATCH /:id does not clear existing dimension value meta when payload omits meta', async () => {
    mockProductRepo.findById.mockResolvedValue({ id: 'p1', name: 'Tee' });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }])
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 0,
      updatedCount: 0,
      archivedCount: 0,
      reactivatedCount: 0,
    });
    mockDimensionRepo.listByProduct.mockResolvedValue([
      {
        id: 'dim-color',
        name: 'Color',
        values: [{ id: 'val-red', value: 'Red', meta: '{"hex":"#ff0000"}' }],
      },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: [{ id: 'dim-color', name: 'Color', values: [{ value: 'Red' }] }],
          variants: [{ id: 'v1', price: 10, cost_price: 6, stock_quantity: 5, alert_threshold: 1, status: 'active' }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockDimensionRepo.updateValueMeta).not.toHaveBeenCalled();
  });

  it('PATCH /:id rolls back variant sync when image reconciliation is ambiguous', async () => {
    mockProductRepo.findById.mockResolvedValue({ id: 'p1', name: 'Tee' });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([
        {
          id: 'v-old',
          product_id: 'p1',
          sku: 'SKU-OLD',
          price: 10,
          cost_price: 6,
          stock_quantity: 5,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Blue' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'v-a',
          product_id: 'p1',
          sku: '',
          price: 11,
          cost_price: 6,
          stock_quantity: 5,
          alert_threshold: 1,
          status: 'active',
          options_values: { Color: 'Red' },
        },
        {
          id: 'v-b',
          product_id: 'p1',
          sku: '',
          price: 12,
          cost_price: 6,
          stock_quantity: 5,
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
      expect.arrayContaining([
        expect.objectContaining({
          id: 'v-old',
          sku: 'SKU-OLD',
          options_values: { Color: 'Blue' },
        }),
      ])
    );
  });
});
