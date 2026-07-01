import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productByIdApp from '../[id]/index.js';

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
  createDimension: vi.fn(),
  updateDimension: vi.fn(),
  addValue: vi.fn(),
  updateValueMeta: vi.fn(),
  restoreSnapshot: vi.fn(),
  archiveDimension: vi.fn(),
  archiveValue: vi.fn(),
};
const mockFolderUtils = {
  ensureVariantFolder: vi.fn(),
  moveFilesToFolder: vi.fn(),
};
const mockScheduleAuditEvent = vi.fn();
const mockScheduleProductCacheInvalidation = vi.fn(async () => []);
const mockCommandIdempotency = {
  reserveCommand: vi.fn(),
  buildDeleteStatement: vi.fn(),
  deleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  buildFinalizeStatement: vi.fn(),
  finalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    findById(...args) {
      return mockProductRepo.findById(...args);
    }
    updateWithMeta(...args) {
      return mockProductRepo.updateWithMeta(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: class {
    syncVariants(...args) {
      return mockVariantRepo.syncVariants(...args);
    }
    findByProductId(...args) {
      return mockVariantRepo.findByProductId(...args);
    }
    buildAuditEvents(..._args) {
      return [
        {
          variant_id: 'v1',
          product_id: 'p1',
          action: 'variant_updated',
          changes: { before: { price: 10 }, after: { price: 12 } },
        },
      ];
    }
  },
}));

vi.mock('../../../../../../repositories/VariantAuditRepository.js', () => ({
  VariantAuditRepository: class {
    createBatch(...args) {
      return mockAuditRepo.createBatch(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    syncImages(...args) {
      return mockVariantImageRepo.syncImages(...args);
    }
    listByVariant(...args) {
      return mockVariantImageRepo.listByVariant(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    listByProduct(...args) {
      return mockDimensionRepo.listByProduct(...args);
    }
    createDimension(...args) {
      return mockDimensionRepo.createDimension(...args);
    }
    updateDimension(...args) {
      return mockDimensionRepo.updateDimension(...args);
    }
    addValue(...args) {
      return mockDimensionRepo.addValue(...args);
    }
    updateValueMeta(...args) {
      return mockDimensionRepo.updateValueMeta(...args);
    }
    restoreSnapshot(...args) {
      return mockDimensionRepo.restoreSnapshot(...args);
    }
    archiveDimension(...args) {
      return mockDimensionRepo.archiveDimension(...args);
    }
    archiveValue(...args) {
      return mockDimensionRepo.archiveValue(...args);
    }
  },
}));

vi.mock('../../../../../../api/utils/folder-utils.js', () => ({
  ensureVariantFolder: (...args) => mockFolderUtils.ensureVariantFolder(...args),
  moveFilesToFolder: (...args) => mockFolderUtils.moveFilesToFolder(...args),
}));

vi.mock('../../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: mockCommandIdempotency.reserveCommand,
    buildDeleteStatement: mockCommandIdempotency.buildDeleteStatement,
    buildFinalizeStatement: mockCommandIdempotency.buildFinalizeStatement,
  })),
}));

vi.mock('../../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
  invalidateCache: vi.fn(async () => {}),
  getProductCacheUrls: vi.fn(() => []),
}));

vi.mock('../cache-helpers.js', () => ({
  scheduleProductCacheInvalidation: (...args) => mockScheduleProductCacheInvalidation(...args),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: (...args) => mockScheduleAuditEvent(...args),
  };
});

function createApp() {
  const app = new Hono();
  app.onError((err, c) => {
    console.error('onError caught:', err);
    return c.json({ success: false, error: err.message }, err.statusCode || 500);
  });
  app.use('/api/manage/products/*', async (c, next) => {
    c.set('user', {
      id: 'u-manager',
      type: 'user',
      role: 'manager',
      permissions: ['products:manage'],
    });
    await next();
  });
  app.route('/api/manage/products', productByIdApp);
  return app;
}

describe('product variant audit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductRepo.findById.mockResolvedValue({ id: 'p1', name: 'Tee' });
    mockAuditRepo.createBatch.mockResolvedValue();
    mockDimensionRepo.listByProduct.mockResolvedValue([]);
    mockDimensionRepo.createDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });
    mockDimensionRepo.updateDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });
    mockDimensionRepo.addValue.mockResolvedValue({ id: 'val-red', value: 'Red' });
    mockDimensionRepo.updateValueMeta.mockResolvedValue();
    mockDimensionRepo.restoreSnapshot.mockResolvedValue(undefined);
    mockDimensionRepo.archiveDimension.mockResolvedValue(undefined);
    mockDimensionRepo.archiveValue.mockResolvedValue(undefined);
    mockVariantImageRepo.listByVariant.mockResolvedValue([]);
    mockVariantImageRepo.syncImages.mockResolvedValue(undefined);
    mockFolderUtils.ensureVariantFolder.mockResolvedValue('folder-variant');
    mockFolderUtils.moveFilesToFolder.mockResolvedValue(undefined);
    mockScheduleProductCacheInvalidation.mockResolvedValue([]);
    mockCommandIdempotency.reserveCommand.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-product-archive-1' },
    });
    mockCommandIdempotency.buildDeleteStatement.mockReturnValue({
      run: mockCommandIdempotency.deleteRun,
    });
    mockCommandIdempotency.buildFinalizeStatement.mockReturnValue({
      run: mockCommandIdempotency.finalizeRun,
    });
    mockScheduleAuditEvent.mockReset();
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
          variants: [
            {
              id: 'v1',
              sku: 'SKU-1',
              price: 12,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
            },
          ],
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
    expect(mockScheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'product.update', domain: 'products' })
    );
  });

  it('DELETE /:id writes archived audit logs for existing variants', async () => {
    mockProductRepo.findById.mockResolvedValue({ id: 'p1' });
    mockVariantRepo.findByProductId.mockResolvedValue([
      { id: 'v1', product_id: 'p1', status: 'active' },
    ]);

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
    expect(mockScheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'product.archive', severity: 'critical' })
    );
  });

  it('DELETE /:id returns 400 when variants exist but archive update affects zero rows', async () => {
    mockProductRepo.findById.mockResolvedValue({ id: 'p1' });
    mockVariantRepo.findByProductId.mockResolvedValue([
      { id: 'v1', product_id: 'p1', status: 'active' },
    ]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      { method: 'DELETE' },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ run: vi.fn(async () => ({ meta: { changes: 0 } })) })),
          })),
        },
        executionCtx: { waitUntil: vi.fn() },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mockAuditRepo.createBatch).not.toHaveBeenCalled();
  });

  it('PATCH /:id syncs images for newly created variant without id', async () => {
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.syncVariants.mockResolvedValue();
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([
        { id: 'v-legacy', product_id: 'p1', sku: 'SKU-OLD', options_values: { Color: 'Blue' } },
      ])
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
            {
              id: 'v-legacy',
              sku: 'SKU-OLD',
              price: 10,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Blue' },
            },
            {
              sku: 'SKU-NEW',
              price: 12,
              cost_price: 7,
              stock_quantity: 4,
              alert_threshold: 1,
              status: 'active',
              options_values: { Color: 'Red' },
              images: [{ image_id: 'img-new', is_primary: 1 }],
            },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockVariantImageRepo.syncImages).toHaveBeenCalledWith('p1', 'v-new', [
      { image_id: 'img-new', is_primary: 1 },
    ]);
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
          variants: [
            {
              id: 'v1',
              price: 12,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
            },
          ],
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
    mockVariantRepo.syncVariants.mockRejectedValueOnce(
      new Error('duplicate variant signature in payload')
    );

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tee',
          variants: [
            {
              sku: 'SKU-RED',
              price: 12,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { color: 'red' },
            },
          ],
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
          variants: [
            {
              id: 'v1',
              sku: 'SKU-1',
              price: 12,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
            },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockProductRepo.updateWithMeta).not.toHaveBeenCalled();
    expect(mockProductRepo.findById).toHaveBeenCalledWith('p1');
  });

  it('PATCH /:id returns 200 for product no-op updates when product still exists', async () => {
    mockProductRepo.findById.mockResolvedValue({
      id: 'p1',
      name: 'Tee',
      currency: 'CNY',
      images: [],
      specifications: {},
      options: [],
    });
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 0 });
    mockVariantRepo.findByProductId.mockResolvedValue([]);
    mockDimensionRepo.listByProduct.mockResolvedValue([]);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tee' }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
  });

  it('PATCH /:id returns 404 when product field updates target a missing product', async () => {
    mockProductRepo.findById.mockResolvedValue(null);
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 0 });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/missing-product',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost Tee' }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
    expect(mockProductRepo.findById).toHaveBeenCalledWith('missing-product');
  });

  it('PUT /:id returns 404 when product is missing', async () => {
    mockProductRepo.findById.mockResolvedValue(null);
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 0 });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/missing-product',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost Tee' }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
    expect(mockProductRepo.findById).toHaveBeenCalledWith('missing-product');
  });

  it('PUT /:id archives missing dimensions and values in full replace mode', async () => {
    mockProductRepo.findById.mockResolvedValue({
      id: 'p1',
      name: 'Tee',
      currency: 'CNY',
      images: [],
      specifications: {},
      options: [],
    });
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.findByProductId
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }])
      .mockResolvedValueOnce([{ id: 'v1', product_id: 'p1', price: 10 }]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 0,
      updatedCount: 1,
      archivedCount: 0,
      reactivatedCount: 0,
    });
    mockDimensionRepo.listByProduct.mockResolvedValue([
      {
        id: 'dim-color',
        name: 'Color',
        status: 'active',
        values: [
          { id: 'val-red', value: 'Red', status: 'active' },
          { id: 'val-blue', value: 'Blue', status: 'active' },
        ],
      },
      {
        id: 'dim-size',
        name: 'Size',
        status: 'active',
        values: [{ id: 'val-m', value: 'M', status: 'active' }],
      },
    ]);
    mockDimensionRepo.updateDimension.mockResolvedValue({ id: 'dim-color', name: 'Color' });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tee',
          dimensions: [{ id: 'dim-color', name: 'Color', values: ['Red'] }],
          variants: [
            {
              id: 'v1',
              sku: 'SKU-1',
              price: 10,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
              options_values: { 'dim-color': 'Red' },
            },
          ],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockDimensionRepo.archiveValue).toHaveBeenCalledWith('p1', 'val-blue');
    expect(mockDimensionRepo.archiveValue).toHaveBeenCalledWith('p1', 'val-m');
    expect(mockDimensionRepo.archiveDimension).toHaveBeenCalledWith('p1', 'dim-size');
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
          variants: [
            {
              id: 'v1',
              sku: 'SKU-1',
              price: 10,
              cost_price: 6,
              stock_quantity: 5,
              alert_threshold: 1,
              status: 'active',
            },
          ],
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
          sku: 'SKU-A',
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
          sku: 'SKU-B',
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
              sku: 'SKU-NEW-RED',
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
