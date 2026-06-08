import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findActiveById: vi.fn(),
  getFiles: vi.fn(),
  markAsRead: vi.fn(),
  setUnread: vi.fn(),
  updateStatus: vi.fn(),
  deleteOrderCascading: vi.fn(),
  getTimeline: vi.fn(),
  processOrderUpdate: vi.fn(),
  productFindById: vi.fn(),
  variantFindByIdAndProductId: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  getManageOrderCacheUrls: vi.fn(() => [
    'http://localhost/api/manage/orders',
    'http://localhost/api/manage/orders?page=1&limit=20',
    'http://localhost/api/manage/orders/stats',
  ]),
  getSalespersonAccessTokens: vi.fn(async () => []),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
  isInsufficientStockError: vi.fn(() => false),
  isInvalidStatusTransitionError: vi.fn(() => false),
  syncOrderTransition: vi.fn(async () => ({})),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.findById,
    findActiveById: mocks.findActiveById,
    getFiles: mocks.getFiles,
    markAsRead: mocks.markAsRead,
    setUnread: mocks.setUnread,
    updateStatus: mocks.updateStatus,
    deleteOrderCascading: mocks.deleteOrderCascading,
    timelineRepo: { addTimelineEntry: vi.fn() },
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

vi.mock('../../../../../repositories/OrderTimelineRepository.js', () => ({
  OrderTimelineRepository: vi.fn(() => ({
    getTimeline: mocks.getTimeline,
  })),
}));

vi.mock('../../../../../repositories/PaymentRepository.js', () => ({
  PaymentRepository: vi.fn(() => ({
    findByOrder: vi.fn(async () => []),
    getTotalPaid: vi.fn(async () => 0),
    getOrderAmount: vi.fn(async () => 0),
  })),
}));

vi.mock('../../../../../repositories/order/history-queries.js', () => ({
  listOrderShipmentHistory: vi.fn(async () => []),
  listOrderReturnHistory: vi.fn(async () => []),
}));

vi.mock('../../../middleware/cache.js', () => ({
  invalidateCache: mocks.invalidateCache,
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getManageOrderCacheUrls: mocks.getManageOrderCacheUrls,
  getOrderAndSalespersonCacheUrls: vi.fn(() => []),
  getOrderNotificationCacheUrls: vi.fn(() => []),
}));

vi.mock('../../../_shared/route-helpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
    scheduleCacheInvalidation: (c, urls) => {
      c.executionCtx.waitUntil(mocks.invalidateCache(urls));
    },
  };
});

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../services/DemandService.js', () => ({
  DemandService: vi.fn(() => ({
    syncOrderTransition: mocks.syncOrderTransition,
  })),
}));

vi.mock('../../../../../services/ProfitService.js', () => ({
  ProfitService: vi.fn(() => ({
    calculateOrderProfit: vi.fn(async () => ({
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: null,
      costComplete: false,
      lines: [],
    })),
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

vi.mock('../orders/error-helpers.js', () => ({
  isInsufficientStockError: mocks.isInsufficientStockError,
  isInvalidStatusTransitionError: mocks.isInvalidStatusTransitionError,
}));

vi.mock('../../../../../api/utils/order-utils.js', () => ({
  processOrderUpdate: mocks.processOrderUpdate,
}));

import detailApp from '../orders/detail.js';

function createApp(
  user = { id: 'u-1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }
) {
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
  app.route('/api/manage/orders', detailApp);
  return app;
}

describe('manage order detail routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'pending',
      salespersonId: 'sp-1',
      currentData: {},
    });
    mocks.findActiveById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'pending',
      salespersonId: 'sp-1',
      currentData: {},
    });
    mocks.getFiles.mockResolvedValue([]);
    mocks.markAsRead.mockResolvedValue(true);
    mocks.setUnread.mockResolvedValue(true);
    mocks.updateStatus.mockResolvedValue(true);
    mocks.deleteOrderCascading.mockResolvedValue(true);
    mocks.getTimeline.mockResolvedValue([]);
    mocks.processOrderUpdate.mockResolvedValue({ success: true, hasChanges: true });
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      name: 'P',
      brand: 'B',
      series: 'S',
      status: 'active',
      specifications: {},
      dimension_map: {},
    });
    mocks.variantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      sku: 'SKU-1',
      status: 'active',
    });
    mocks.isInsufficientStockError.mockReturnValue(false);
    mocks.isInvalidStatusTransitionError.mockReturnValue(false);
    mocks.syncOrderTransition.mockResolvedValue({});
  });

  it('enqueues admin read cache invalidation through outbox after GET /:id', async () => {
    const waitUntil = vi.fn();
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.markAsRead).toHaveBeenCalledWith('order-1', 'admin');
    const [publishedEvents] = mocks.publish.mock.calls[0] || [];
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'order_read_by_admin',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          order_id: 'order-1',
          salesperson_id: 'sp-1',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
  });

  it('does not load archived orders or emit read side effects on ordinary admin detail reads', async () => {
    mocks.findById.mockResolvedValueOnce({
      id: 'order-archived',
      orderNo: 'SO-ARCH',
      status: 'pending',
      salespersonId: 'sp-1',
      archivedAt: 1710000000000,
    });
    mocks.findActiveById.mockResolvedValueOnce(null);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-archived',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
    expect(mocks.findActiveById).toHaveBeenCalledWith('order-archived');
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.markAsRead).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('marks sales side unread when admin adds comment', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/comment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'need follow-up' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.setUnread).toHaveBeenCalledWith('order-1', 'admin');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.comment.create', domain: 'orders' })
    );
  });

  it('returns 400 when admin submits an empty comment payload', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/comment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: '' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.setUnread).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('rejects comments on archived orders before side effects run', async () => {
    mocks.findById.mockResolvedValueOnce({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'confirmed',
      salespersonId: 'sp-1',
      currentData: {},
      archivedAt: 1710000000000,
    });
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/comment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'should not write' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.setUnread).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('enqueues deferred order-update side effects via outbox after PATCH /:id', async () => {
    mocks.processOrderUpdate.mockResolvedValue({
      success: true,
      hasChanges: true,
      outboxEvents: [
        {
          event_type: 'order_updated_by_admin',
          aggregate_type: 'order',
          aggregate_id: 'order-1',
          payload: {
            order_id: 'order-1',
            order_no: 'SO-1',
            salesperson_id: 'sp-1',
            actor_name: 'Admin',
          },
        },
      ],
    });
    const waitUntil = vi.fn();
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { remark: 'next' }, reason: 'ops' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_updated_by_admin',
        aggregate_id: 'order-1',
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('enqueues order status change side effects via outbox after PATCH /:id/status', async () => {
    const waitUntil = vi.fn();
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_status_changed_by_admin',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          order_id: 'order-1',
          order_no: 'SO-1',
          salesperson_id: 'sp-1',
          status: 'confirmed',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('rejects status changes on archived orders', async () => {
    mocks.findById.mockResolvedValueOnce({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'pending',
      salespersonId: 'sp-1',
      currentData: {},
      archivedAt: 1710000000000,
    });
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('allows privileged admin user to delete order', async () => {
    const waitUntil = vi.fn();
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      { method: 'DELETE' },
      { DB: { prepare: vi.fn() } },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.deleteOrderCascading).toHaveBeenCalledWith('order-1');
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_deleted_by_admin',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          order_id: 'order-1',
          order_no: 'SO-1',
          salesperson_id: 'sp-1',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.delete', severity: 'critical' })
    );
  });

  it('allows role=admin user to force status transition through OPA decision', async () => {
    const app = createApp({
      id: 'u-opa',
      name: 'DB Admin',
      type: 'user',
      role: 'admin',
      permissions: [],
    });
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered', force: true, note: 'opa allows admin role' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      'order-1',
      'delivered',
      'admin',
      expect.objectContaining({ forceStatusTransition: true })
    );
  });

  it('allows role=admin user to delete order through OPA decision', async () => {
    const app = createApp({
      id: 'u-opa',
      name: 'DB Admin',
      type: 'user',
      role: 'admin',
      permissions: [],
    });
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      { method: 'DELETE' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.deleteOrderCascading).toHaveBeenCalledWith('order-1');
  });

  it('returns 403 when non-admin user tries to delete order', async () => {
    const app = createApp({
      id: 'u-viewer',
      name: 'ViewerUser',
      type: 'user',
      role: 'viewer',
      permissions: [],
    });
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      { method: 'DELETE' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(403);
    expect(mocks.deleteOrderCascading).not.toHaveBeenCalled();
  });

  it('rejects invalid status value in PATCH /:id/status', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'unknown-status' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when PATCH /:id/status hits insufficient stock error', async () => {
    mocks.findById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'arrived',
      salespersonId: 'sp-1',
      currentData: {},
    });
    mocks.updateStatus.mockRejectedValue(new Error('insufficient variant stock for delivery'));
    mocks.isInsufficientStockError.mockReturnValue(true);
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error || '')).toMatch(/insufficient stock/i);
  });

  it('returns 400 when PATCH /:id/status hits invalid transition marker from repository', async () => {
    mocks.updateStatus.mockRejectedValue(
      new Error('INVALID_ORDER_STATUS_TRANSITION_ERROR: pending -> delivered')
    );
    mocks.isInvalidStatusTransitionError.mockReturnValue(true);
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'delivered',
          force: true,
          note: 'forced request still rejected',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error || '')).toMatch(/invalid status transition/i);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('returns 400 when PATCH /:id/status repository update reports no change', async () => {
    mocks.updateStatus.mockResolvedValue(false);
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('syncs multi-line demand per bound line after status changes', async () => {
    mocks.findById.mockResolvedValueOnce({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'pending',
      salespersonId: 'sp-1',
      variantId: null,
      quantity: 5,
      currentData: {},
      lines: [
        { id: 'line-1', productId: 'p-1', variantId: 'v-1', quantity: 2 },
        { id: 'line-2', productId: 'p-2', variantId: 'v-2', quantity: 3 },
      ],
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.syncOrderTransition).toHaveBeenCalledTimes(2);
    expect(mocks.syncOrderTransition).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 'order-1',
        orderLineId: 'line-1',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        quantity: 2,
        productId: 'p-1',
        variantId: 'v-1',
      })
    );
    expect(mocks.syncOrderTransition).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderId: 'order-1',
        orderLineId: 'line-2',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        quantity: 3,
        productId: 'p-2',
        variantId: 'v-2',
      })
    );
  });

  it('returns 404 when GET /:id cannot find the order', async () => {
    mocks.findById.mockResolvedValueOnce(null);
    mocks.findActiveById.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/missing-order',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(404);
    expect(mocks.markAsRead).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('returns 400 when PATCH /:id/status is out-of-flow without force', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when force status transition has no note', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered', force: true }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when non-admin forces PATCH /:id/status transition', async () => {
    const app = createApp({
      id: 'u-viewer',
      name: 'ViewerUser',
      type: 'user',
      role: 'viewer',
      permissions: [],
    });
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered', force: true, note: 'try force as viewer' }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(403);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('allows force override transition with note for privileged admin', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'delivered',
          force: true,
          note: 'manual emergency override',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      'order-1',
      'delivered',
      'admin',
      expect.objectContaining({ forceStatusTransition: true })
    );
  });

  it('allows order patch without product status column (post-migration 0043)', async () => {
    // products 表自迁移 0043 起不再包含 status 列，产品级别不再检查活跃状态
    // 此测试验证简单的订单更新（不涉及商品绑定变更）不因产品状态检查失败
    mocks.processOrderUpdate.mockResolvedValue({ success: true, hasChanges: true });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { remark: 'updated' },
          reason: 'test update',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalled();
  });

  it('rejects order patch when bound variant is archived', async () => {
    mocks.variantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      sku: 'SKU-1',
      status: 'archived',
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { remark: 'updated' },
          productId: 'p-1',
          variantId: 'v-1',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
  });

  it('preserves existing bound snapshots during ordinary edits', async () => {
    mocks.findById
      .mockResolvedValueOnce({
        id: 'order-1',
        orderNo: 'SO-1',
        status: 'pending',
        salespersonId: 'sp-1',
        productId: 'p-1',
        variantId: 'v-1',
        quantity: 2,
        currentData: {
          name: 'Frozen Name',
          brand: 'Frozen Brand',
          series: 'Frozen Series',
          sku: 'FROZEN-SKU',
          size: 'Size: M',
          color: 'Black',
          material: 'Leather',
        },
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        orderNo: 'SO-1',
        status: 'pending',
        salespersonId: 'sp-1',
        productId: 'p-1',
        variantId: 'v-1',
        quantity: 2,
        currentData: {
          name: 'Frozen Name',
          brand: 'Frozen Brand',
          series: 'Frozen Series',
          sku: 'FROZEN-SKU',
          size: 'Size: M',
          color: 'Black',
          material: 'Leather',
          remark: 'updated',
        },
      });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            remark: 'updated',
            name: 'Live Rename',
            brand: 'Live Brand',
            series: 'Live Series',
            sku: 'LIVE-SKU',
            size: 'Size: XL',
            color: 'White',
            material: 'Metal',
          },
          reason: 'ordinary edit',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.productFindById).not.toHaveBeenCalled();
    expect(mocks.variantFindByIdAndProductId).not.toHaveBeenCalled();
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: { remark: 'updated' },
      })
    );
  });

  it('returns updated order payload after PATCH /:id', async () => {
    mocks.findById
      .mockResolvedValueOnce({
        id: 'order-1',
        orderNo: 'SO-1',
        status: 'pending',
        salespersonId: 'sp-1',
        currentData: { name: 'old-name' },
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        orderNo: 'SO-1',
        status: 'confirmed',
        salespersonId: 'sp-1',
        currentData: { name: 'server-name' },
      });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { status: 'confirmed', name: 'optimistic-name' },
          reason: 'admin patch',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: 'order-1',
      status: 'confirmed',
    });
    expect(mocks.findById).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.update', domain: 'orders' })
    );
  });

  it('normalizes multi-line updates before forwarding them into the shared order update flow', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            lines: [
              { productName: 'Line A', quantity: 2, sku: 'SKU-A' },
              { productName: 'Line B', quantity: 3, sku: 'SKU-B' },
            ],
          },
          reason: 'reshape order lines',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: expect.objectContaining({
          name: 'Line A',
          sku: 'SKU-A',
          quantity: 5,
          lines: [
            expect.objectContaining({ name: 'Line A', sku: 'SKU-A', quantity: 2 }),
            expect.objectContaining({ name: 'Line B', sku: 'SKU-B', quantity: 3 }),
          ],
        }),
        productId: null,
        variantId: null,
      })
    );
  });

  it('backfills header-level binding when multi-line orders are reshaped into a single bound line', async () => {
    mocks.findById.mockResolvedValueOnce({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'pending',
      salespersonId: 'sp-1',
      productId: null,
      variantId: null,
      quantity: 5,
      currentData: {},
      lines: [
        { id: 'line-1', productId: 'p-1', variantId: 'v-1', quantity: 2 },
        { id: 'line-2', productId: 'p-2', variantId: 'v-2', quantity: 3 },
      ],
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            lines: [
              {
                productName: 'Line A',
                quantity: 2,
                sku: 'SKU-A',
                productId: 'p-1',
                variantId: 'v-1',
              },
            ],
          },
          reason: 'collapse to one line',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: expect.objectContaining({
          quantity: 2,
          lines: [expect.objectContaining({ productId: 'p-1', variantId: 'v-1', quantity: 2 })],
        }),
        productId: 'p-1',
        variantId: 'v-1',
      })
    );
  });

  it('clears header-level binding when a single bound order is reshaped into one manual line', async () => {
    mocks.findById.mockResolvedValueOnce({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'pending',
      salespersonId: 'sp-1',
      productId: 'p-legacy',
      variantId: 'v-legacy',
      quantity: 1,
      currentData: {},
      lines: [{ id: 'line-1', productId: 'p-legacy', variantId: 'v-legacy', quantity: 1 }],
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            lines: [{ productName: 'Manual Line', quantity: 1, sku: 'SKU-MANUAL' }],
          },
          reason: 'unbind collapsed line',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        updates: expect.objectContaining({
          quantity: 1,
          lines: [expect.objectContaining({ productId: null, variantId: null, quantity: 1 })],
        }),
        productId: null,
        variantId: null,
      })
    );
  });

  it('rejects PATCH /:id status jump without force override', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { status: 'delivered' },
          reason: 'normal edit',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
  });

  it('allows PATCH /:id status jump with force and reason', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { status: 'delivered' },
          force: true,
          reason: 'backfill legacy order state',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        forceStatusTransition: true,
      })
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.update', severity: 'high' })
    );
  });

  it('returns 403 when non-admin forces PATCH /:id status jump', async () => {
    const app = createApp({
      id: 'u-viewer',
      name: 'ViewerUser',
      type: 'user',
      role: 'viewer',
      permissions: [],
    });
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { status: 'delivered' },
          force: true,
          reason: 'try force as viewer',
        }),
      },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(403);
    expect(mocks.processOrderUpdate).not.toHaveBeenCalled();
  });
});
