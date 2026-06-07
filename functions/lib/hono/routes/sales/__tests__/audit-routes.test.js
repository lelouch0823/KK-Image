import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  markAllAsReadForSalesperson: vi.fn(),
  markAsReadForSalesperson: vi.fn(),
  updateWechatOpenid: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/NotificationRepository.js', () => ({
  NotificationRepository: vi.fn(() => ({
    listForSalesperson: vi.fn(async () => []),
    markAllAsReadForSalesperson: mocks.markAllAsReadForSalesperson,
    markAsReadForSalesperson: mocks.markAsReadForSalesperson,
  })),
}));

vi.mock('../../../../../repositories/SalespersonRepository.js', () => ({
  SalespersonRepository: vi.fn(() => ({
    updateWechatOpenid: mocks.updateWechatOpenid,
  })),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getSalesNotificationCacheUrls: vi.fn(() => ['http://localhost/api/sales/token-1/notifications']),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    scheduleCacheInvalidation: mocks.scheduleCacheInvalidation,
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

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import notificationsApp from '../notifications.js';
import profileApp from '../profile.js';

function createApp(basePath, route) {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/sales/:token/*', async (c, next) => {
    c.set('salesperson', { id: 'sales-1', name: 'Alice', store: 'Store', phone: '123' });
    await next();
  });
  app.route(basePath, route);
  return app;
}

describe('sales audit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markAllAsReadForSalesperson.mockResolvedValue(undefined);
    mocks.markAsReadForSalesperson.mockResolvedValue(undefined);
    mocks.updateWechatOpenid.mockResolvedValue(undefined);
    mocks.scheduleCacheInvalidation.mockImplementation(() => {});
  });

  it('audits marking all sales notifications as read', async () => {
    const app = createApp('/api/sales/:token/notifications', notificationsApp);
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/sales/token-1/notifications/all/read',
      { method: 'POST' },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.markAllAsReadForSalesperson).toHaveBeenCalledWith('sales-1');
    const [publishedEvents, publishContext] = mocks.publish.mock.calls[0];
    expect(publishContext).toBeUndefined();
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'notification_read_by_sales',
        aggregate_type: 'notification',
        aggregate_id: 'all',
        payload: expect.objectContaining({
          notification_id: 'all',
          salesperson_id: 'sales-1',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sales.notification.read',
        targetId: 'all',
        summary: 'Marked all sales notifications as read',
      })
    );
  });

  it('audits salesperson WeChat binding', async () => {
    const app = createApp('/api/sales/:token/profile', profileApp);
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ openid: 'wx-openid-1' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const res = await app.request(
        'http://localhost/api/sales/token-1/profile/bind-wechat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'wechat-code' }),
        },
        { DB: {}, JWT_SECRET: 'secret', WECHAT_APPID: 'appid', WECHAT_SECRET: 'secret' },
        { waitUntil: vi.fn() }
      );

      expect(res.status).toBe(200);
      expect(mocks.updateWechatOpenid).toHaveBeenCalledWith('sales-1', 'wx-openid-1');
      expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'sales.profile.bind_wechat',
          targetId: 'sales-1',
          target_label: 'Alice',
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
