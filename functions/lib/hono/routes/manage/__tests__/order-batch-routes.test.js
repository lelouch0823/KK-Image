import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  batchUpdateStatus: vi.fn(),
  findById: vi.fn(),
  productFindById: vi.fn(),
  variantFindByIdAndProductId: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  getSalespersonAccessTokens: vi.fn(async () => []),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
  isInsufficientStockError: vi.fn(() => false),
  isInvalidStatusTransitionError: vi.fn(() => false),
  syncOrderTransition: vi.fn(async () => ({})),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    create: mocks.create,
    batchUpdateStatus: mocks.batchUpdateStatus,
    findById: mocks.findById,
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

vi.mock('../../../_shared/route-helpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
  };
});

vi.mock('../../_shared/cache-urls.js', () => ({
  getOrderAndSalespersonCacheUrls: vi.fn(() => ['http://localhost/api/manage/orders']),
  getOrderNotificationCacheUrls: vi.fn(() => ['http://localhost/api/manage/notifications']),
}));

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

vi.mock('../orders/error-helpers.js', () => ({
  isInsufficientStockError: mocks.isInsufficientStockError,
  isInvalidStatusTransitionError: mocks.isInvalidStatusTransitionError,
}));

vi.mock('../../../../../services/DemandService.js', () => ({
  DemandService: vi.fn(() => ({
    syncOrderTransition: mocks.syncOrderTransition,
  })),
}));

import createAppRoutes from '../orders/create.js';

const createApp = (
  user = { id: 'u-1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }
) => {
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
    mocks.findById.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      status: 'confirmed',
      quantity: 2,
      productId: null,
      variantId: null,
      lines: [
        { id: 'line-1', productId: 'p-1', variantId: 'v-1', quantity: 1 },
        { id: 'line-2', productId: 'p-2', variantId: 'v-2', quantity: 1 },
      ],
    });
    mocks.productFindById.mockResolvedValue({ id: 'p-1', status: 'active' });
    mocks.variantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      status: 'active',
    });
    mocks.publish.mockResolvedValue([]);
    mocks.runOutboxPoller.mockResolvedValue({ claimed: 0, published: 0, failed: 0 });
    mocks.isInsufficientStockError.mockReturnValue(false);
    mocks.isInvalidStatusTransitionError.mockReturnValue(false);
    mocks.syncOrderTransition.mockResolvedValue({});
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
    mocks.isInsufficientStockError.mockReturnValue(true);
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
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'arrived' },
                ],
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
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                ],
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

  it('returns 400 when batch status update includes an archived order', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-archived'],
          action: 'status',
          value: 'confirmed',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [
                  {
                    id: 'o-archived',
                    order_no: 'SO-ARCH',
                    salesperson_id: 'sp-1',
                    status: 'pending',
                    archived_at: 1710000000000,
                  },
                ],
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

  it('returns 400 when batch request has no valid ids', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [],
          action: 'status',
          value: 'confirmed',
        }),
      },
      { DB: { prepare: vi.fn() } },
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
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                ],
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

  it('returns 400 when repository rejects batch status with invalid transition marker', async () => {
    mocks.batchUpdateStatus.mockRejectedValue(
      new Error('INVALID_ORDER_STATUS_TRANSITION_ERROR: pending -> delivered')
    );
    mocks.isInvalidStatusTransitionError.mockReturnValue(true);
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
          reason: 'force but repository still rejects',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                ],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error || '')).toMatch(/invalid status transition/i);
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
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                ],
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
    const app = createApp({
      id: 'u-opa',
      name: 'DB Admin',
      type: 'user',
      role: 'admin',
      permissions: [],
    });
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
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                ],
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

  it('publishes batch status change events and schedules outbox polling for matched orders', async () => {
    const app = createApp();
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1', 'o-2'],
          action: 'status',
          value: 'confirmed',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                  { id: 'o-2', order_no: 'SO-2', salesperson_id: 'sp-2', status: 'pending' },
                ],
              })),
            })),
          })),
        },
      },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.batchUpdateStatus).toHaveBeenCalledWith(
      ['o-1', 'o-2'],
      'confirmed',
      expect.objectContaining({ actorType: 'admin' }),
      expect.objectContaining({ forceStatusTransition: false })
    );
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_status_changed_by_admin',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          order_id: 'o-1',
          order_no: 'SO-1',
          salesperson_id: 'sp-1',
          status: 'confirmed',
          batch: true,
        }),
      }),
      expect.objectContaining({
        event_type: 'order_status_changed_by_admin',
        aggregate_id: 'o-2',
        payload: expect.objectContaining({
          order_id: 'o-2',
          order_no: 'SO-2',
          salesperson_id: 'sp-2',
          status: 'confirmed',
          batch: true,
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('syncs demand per bound line after batch status updates', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['o-1'],
          action: 'status',
          value: 'confirmed',
        }),
      },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({
                results: [
                  { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'pending' },
                ],
              })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.findById).toHaveBeenCalledWith('o-1');
    expect(mocks.syncOrderTransition).toHaveBeenCalledTimes(2);
    expect(mocks.syncOrderTransition).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 'o-1',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        orderLineId: 'line-1',
        variantId: 'v-1',
      })
    );
    expect(mocks.syncOrderTransition).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderId: 'o-1',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        orderLineId: 'line-2',
        variantId: 'v-2',
      })
    );
  });
});
