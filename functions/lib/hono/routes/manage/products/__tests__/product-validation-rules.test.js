import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import productsApp from '../index.js';
import productByIdApp from '../[id].js';

const mockProductRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySpu: vi.fn(),
  updateWithMeta: vi.fn(),
};
const mockVariantRepo = {
  createBatch: vi.fn(),
  syncVariants: vi.fn(),
  findByProductId: vi.fn(),
};
const mockDimensionRepo = {
  listByProduct: vi.fn(),
  createDimension: vi.fn(),
  addValue: vi.fn(),
  updateDimension: vi.fn(),
  updateValueMeta: vi.fn(),
};

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    create(...args) { return mockProductRepo.create(...args); }
    findById(...args) { return mockProductRepo.findById(...args); }
    findBySpu(...args) { return mockProductRepo.findBySpu(...args); }
    updateWithMeta(...args) { return mockProductRepo.updateWithMeta(...args); }
  },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: class {
    createBatch(...args) { return mockVariantRepo.createBatch(...args); }
    syncVariants(...args) { return mockVariantRepo.syncVariants(...args); }
    findByProductId(...args) { return mockVariantRepo.findByProductId(...args); }
    buildAuditEvents() { return []; }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    listByProduct(...args) { return mockDimensionRepo.listByProduct(...args); }
    createDimension(...args) { return mockDimensionRepo.createDimension(...args); }
    addValue(...args) { return mockDimensionRepo.addValue(...args); }
    updateDimension(...args) { return mockDimensionRepo.updateDimension(...args); }
    updateValueMeta(...args) { return mockDimensionRepo.updateValueMeta(...args); }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    syncImages() { return undefined; }
  },
}));

vi.mock('../../../../../../repositories/VariantAuditRepository.js', () => ({
  VariantAuditRepository: class {
    createBatch() { return undefined; }
  },
}));

vi.mock('../../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
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
  app.route('/api/manage/products', productsApp);
  app.route('/api/manage/products', productByIdApp);
  return app;
}

function createVariant(overrides = {}) {
  return {
    sku: 'SKU-1',
    price: 100,
    cost_price: 60,
    stock_quantity: 5,
    alert_threshold: 2,
    status: 'active',
    options_values: { Color: 'Red' },
    ...overrides,
  };
}

describe('product validation rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductRepo.findById.mockResolvedValue({ id: 'p1', name: 'Tee' });
    mockProductRepo.findBySpu.mockResolvedValue(null);
    mockProductRepo.updateWithMeta.mockResolvedValue({ success: true, changes: 1 });
    mockVariantRepo.findByProductId.mockResolvedValue([]);
    mockVariantRepo.syncVariants.mockResolvedValue({
      createdCount: 0,
      updatedCount: 1,
      archivedCount: 0,
      reactivatedCount: 0,
    });
    mockDimensionRepo.listByProduct.mockResolvedValue([]);
    mockDimensionRepo.createDimension.mockResolvedValue({ id: 'dim-1', name: 'Color' });
    mockDimensionRepo.addValue.mockResolvedValue({ id: 'value-1', value: 'Red' });
    mockDimensionRepo.updateDimension.mockResolvedValue({ id: 'dim-1', name: 'Color' });
    mockDimensionRepo.updateValueMeta.mockResolvedValue(undefined);
  });

  it('rejects invalid currency, negative price/stock, invalid status, and empty variants', async () => {
    const app = createApp();

    const invalidCurrency = await app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tee', currency: 'INVALID', variants: [createVariant()] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(invalidCurrency.status).toBe(400);

    const negativePrice = await app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tee', variants: [createVariant({ price: -1 })] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(negativePrice.status).toBe(400);

    const negativeStock = await app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tee', variants: [createVariant({ stock_quantity: -3 })] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(negativeStock.status).toBe(400);

    const invalidStatus = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: [createVariant({ id: 'variant-1', status: 'disabled' })] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(invalidStatus.status).toBe(400);

    const emptyVariants = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: [] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(emptyVariants.status).toBe(400);
  });

  it('rejects empty sku on both create and patch', async () => {
    const app = createApp();

    const createRes = await app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tee', variants: [createVariant({ sku: '' })] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(createRes.status).toBe(400);

    const patchRes = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: [createVariant({ id: 'variant-1', sku: '' })] }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );
    expect(patchRes.status).toBe(400);
  });

  it('allows patching an existing variant without stock_quantity', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: [{ id: 'variant-1', sku: 'SKU-1', price: 100, cost_price: 60, alert_threshold: 2, status: 'active' }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
  });

  it('does not mutate dimensions before rejecting an invalid patch payload', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: [{ name: 'Color', values: [{ value: 'Red' }] }],
          variants: [{ id: 'variant-1', sku: '', price: 100, cost_price: 60, alert_threshold: 2, status: 'active' }],
        }),
      },
      { DB: {}, executionCtx: { waitUntil: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mockDimensionRepo.createDimension).not.toHaveBeenCalled();
    expect(mockDimensionRepo.updateDimension).not.toHaveBeenCalled();
    expect(mockDimensionRepo.addValue).not.toHaveBeenCalled();
  });
});
