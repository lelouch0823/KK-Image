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
}));

vi.mock('../../../../../api/utils/order-utils.js', () => ({
  createOrderNotification: vi.fn(async () => {}),
  processOrderUpdate: mocks.processOrderUpdate,
}));

import detailApp from '../orders/detail.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'u-1', name: 'Admin', type: 'admin', permissions: ['admin:full'] });
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
});
