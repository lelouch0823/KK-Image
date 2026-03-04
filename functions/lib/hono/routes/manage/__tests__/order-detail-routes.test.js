import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
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
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.findById,
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

vi.mock('../../../middleware/cache.js', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getManageOrderCacheUrls: mocks.getManageOrderCacheUrls,
  getOrderAndSalespersonCacheUrls: vi.fn(() => []),
  getOrderNotificationCacheUrls: vi.fn(() => []),
}));

vi.mock('../../../_shared/route-helpers.js', () => ({
  getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
  scheduleCacheInvalidation: (c, urls) => {
    c.executionCtx.waitUntil(mocks.invalidateCache(urls));
  },
}));

vi.mock('../../../../../api/utils/order-utils.js', () => ({
  createOrderNotification: vi.fn(async () => {}),
  processOrderUpdate: mocks.processOrderUpdate,
}));

import detailApp from '../orders/detail.js';

function createApp(user = { id: 'u-1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }) {
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
    });
    mocks.variantFindByIdAndProductId.mockResolvedValue({
      id: 'v-1',
      product_id: 'p-1',
      sku: 'SKU-1',
      status: 'active',
    });
  });

  it('invalidates manage order list caches after admin read via GET /:id', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      { method: 'GET' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.markAsRead).toHaveBeenCalledWith('order-1', 'admin');
    expect(mocks.getManageOrderCacheUrls).toHaveBeenCalled();
    expect(mocks.invalidateCache).toHaveBeenCalledWith(
      expect.arrayContaining([
        'http://localhost/api/manage/orders',
        'http://localhost/api/manage/orders?page=1&limit=20',
      ])
    );
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
  });

  it('allows privileged admin user to delete order', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders/order-1',
      { method: 'DELETE' },
      { DB: { prepare: vi.fn() } },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.deleteOrderCascading).toHaveBeenCalledWith('order-1');
  });

  it('allows role=admin user to force status transition through OPA decision', async () => {
    const app = createApp({ id: 'u-opa', name: 'DB Admin', type: 'user', role: 'admin', permissions: [] });
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
    const app = createApp({ id: 'u-opa', name: 'DB Admin', type: 'user', role: 'admin', permissions: [] });
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
    const app = createApp({ id: 'u-viewer', name: 'Viewer', type: 'user', role: 'viewer', permissions: [] });
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
    const app = createApp({ id: 'u-viewer', name: 'Viewer', type: 'user', role: 'viewer', permissions: [] });
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
        body: JSON.stringify({ status: 'delivered', force: true, note: 'manual emergency override' }),
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

  it('rejects order patch when bound product is archived', async () => {
    mocks.productFindById.mockResolvedValue({
      id: 'p-1',
      name: 'P',
      brand: 'B',
      series: 'S',
      status: 'archived',
      specifications: {},
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
    expect(mocks.processOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      forceStatusTransition: true,
    }));
  });

  it('returns 403 when non-admin forces PATCH /:id status jump', async () => {
    const app = createApp({ id: 'u-viewer', name: 'Viewer', type: 'user', role: 'viewer', permissions: [] });
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
