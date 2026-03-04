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

const createApp = (user = { id: 'u-1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }) => {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', user);
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
      expect.objectContaining({ actorType: 'admin' }),
      expect.objectContaining({ forceStatusTransition: false })
    );
  });

  it('returns 400 when batch delivered transition fails due to insufficient stock', async () => {
    mocks.batchUpdateStatus.mockRejectedValue(new Error('insufficient variant stock for delivery'));
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'status',
          value: 'delivered',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [{ id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'arrived' }],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error || '')).toMatch(/insufficient stock/i);
  });

  it('returns 400 when batch transition is out-of-flow and no force flag is provided', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'status',
          value: 'delivered',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [{ id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' }],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.batchUpdateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when force batch transition has no reason', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'status',
          value: 'delivered',
          force: true,
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [{ id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' }],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.batchUpdateStatus).not.toHaveBeenCalled();
  });

  it('allows force batch transition when reason is provided', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'status',
          value: 'delivered',
          force: true,
          reason: 'manual override for legacy sync',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [{ id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' }],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.batchUpdateStatus).toHaveBeenCalledWith(
      ['o-1'],
      'delivered',
      expect.objectContaining({ actorType: 'admin' }),
      expect.objectContaining({ forceStatusTransition: true })
    );
  });

  it('allows role=admin user to force batch transition through OPA decision', async () => {
    const app = createApp({ id: 'u-opa', name: 'DB Admin', type: 'user', role: 'admin', permissions: [] });
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'status',
          value: 'delivered',
          force: true,
          reason: 'opa allows admin role',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [{ id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' }],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.batchUpdateStatus).toHaveBeenCalledWith(
      ['o-1'],
      'delivered',
      expect.objectContaining({ actorType: 'admin' }),
      expect.objectContaining({ forceStatusTransition: true })
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
