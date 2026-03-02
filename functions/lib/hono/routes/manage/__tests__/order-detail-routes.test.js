import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  getFiles: vi.fn(),
  markAsRead: vi.fn(),
  getTimeline: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  getManageOrderCacheUrls: vi.fn(() => [
    'http://localhost/api/manage/orders',
    'http://localhost/api/manage/orders?page=1&limit=20',
    'http://localhost/api/manage/orders/stats',
  ]),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.findById,
    getFiles: mocks.getFiles,
    markAsRead: mocks.markAsRead,
    timelineRepo: { addTimelineEntry: vi.fn() },
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

import detailApp from '../orders/detail.js';

function createApp() {
  const app = new Hono();
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
    mocks.getTimeline.mockResolvedValue([]);
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
});
