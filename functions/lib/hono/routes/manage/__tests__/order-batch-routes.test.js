import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  batchUpdateStatus: vi.fn(),
  productFindById: vi.fn(),
  variantFindByIdAndProductId: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  getSalespersonAccessTokens: vi.fn(async () => []),
  createBatchOrderNotifications: vi.fn(async () => {}),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    create: mocks.create,
    batchUpdateStatus: mocks.batchUpdateStatus,
  })),
}));

vi.mock('../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: vi.fn(() => ({
    findById: mocks.productFindById,
  })),
}));

vi.mock('../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: vi.fn(() => ({
    findByIdAndProductId: mocks.variantFindByIdAndProductId,
  })),
}));

vi.mock('../../../middleware/cache.js', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../../_shared/route-helpers.js', () => ({
  getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
}));

vi.mock('../../../../../api/utils/order-utils.js', () => ({
  createBatchOrderNotifications: mocks.createBatchOrderNotifications,
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getOrderAndSalespersonCacheUrls: vi.fn(() => ['http://localhost/api/manage/orders']),
  getOrderNotificationCacheUrls: vi.fn(() => ['http://localhost/api/manage/notifications']),
}));

import createAppRoutes from '../orders/create.js';

const createApp = () => {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'u-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', createAppRoutes);
  return app;
};

describe('manage order batch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(true);
    mocks.batchUpdateStatus.mockResolvedValue(true);
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'active' });
    mocks.variantFindByIdAndProductId.mockResolvedValue({ id: 'v-1', product_id: 'p-1', status: 'active' });
  });

  it('maps frontend confirm action to status=confirmed', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1', 'o-2'],
          action: 'confirm',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({ results: [] })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.batchUpdateStatus).toHaveBeenCalledWith(
      ['o-1', 'o-2'],
      'confirmed',
      expect.objectContaining({ actorType: 'admin' })
    );
  });

  it('rejects unsupported batch action', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'invalid-action',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.batchUpdateStatus).not.toHaveBeenCalled();
  });

  it('rejects create order when bound product is archived', async () => {
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'archived' });
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Shoe',
          salespersonId: 'sp-1',
          productId: 'p-1',
          variantId: 'v-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects create order when bound variant is archived', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValue({ id: 'v-1', product_id: 'p-1', status: 'archived' });
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Shoe',
          salespersonId: 'sp-1',
          productId: 'p-1',
          variantId: 'v-1',
          fileIds: [],
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
