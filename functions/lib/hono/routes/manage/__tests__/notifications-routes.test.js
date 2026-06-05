import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoListForAdmin: vi.fn(),
  repoPollForAdmin: vi.fn(),
  repoMarkAsReadForAdmin: vi.fn(),
  repoMarkAllAsReadForAdmin: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishSingleDomainEventAndPoll: vi.fn(),
}));

vi.mock('../../../../../repositories/NotificationRepository.ts', () => ({
  NotificationRepository: vi.fn(() => ({
    listForAdmin: mocks.repoListForAdmin,
    pollForAdmin: mocks.repoPollForAdmin,
    markAsReadForAdmin: mocks.repoMarkAsReadForAdmin,
    markAllAsReadForAdmin: mocks.repoMarkAllAsReadForAdmin,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

vi.mock('../../../_shared/audit-helpers.js', () => ({
  scheduleAuditEvent: (...args) => mocks.scheduleAuditEvent(...args),
}));

vi.mock('../../../_shared/domain-outbox.js', () => ({
  publishSingleDomainEventAndPoll: (...args) => mocks.publishSingleDomainEventAndPoll(...args),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    parsePagination: vi.fn(() => ({ page: 1, limit: 20, offset: 0 })),
  };
});

import notificationsApp from '../notifications.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/notifications', notificationsApp);
  return app;
}

const ENV = { DB: {} };
const CTX = { waitUntil: vi.fn() };

describe('manage notifications routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.repoListForAdmin.mockResolvedValue([
      { id: 'n-1', type: 'system', title: '系统通知', content: '内容', is_read: 0, created_at: 1 },
    ]);
    mocks.repoPollForAdmin.mockResolvedValue({
      unreadCount: 3,
      latestId: 'n-3',
      newNotifications: [],
    });
    mocks.repoMarkAsReadForAdmin.mockResolvedValue(undefined);
    mocks.repoMarkAllAsReadForAdmin.mockResolvedValue(undefined);
    mocks.scheduleAuditEvent.mockResolvedValue(undefined);
    mocks.publishSingleDomainEventAndPoll.mockResolvedValue(undefined);
  });

  describe('GET /', () => {
    it('返回通知列表', async () => {
      const res = await app.request('/api/manage/notifications', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe('系统通知');
    });
  });

  describe('POST /', () => {
    it('创建通知成功', async () => {
      const res = await app.request('/api/manage/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新通知', content: '详情', type: 'system' }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalled();
      expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'notification.create',
          target_label: '新通知',
        })
      );
    });

    it('缺少 title 时返回 400', async () => {
      const res = await app.request('/api/manage/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '没有标题' }),
      }, ENV, CTX);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /:id/read', () => {
    it('标记单条通知已读', async () => {
      const res = await app.request('/api/manage/notifications/n-1/read', {
        method: 'POST',
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoMarkAsReadForAdmin).toHaveBeenCalledWith('n-1');
    });

    it('标记所有通知已读', async () => {
      const res = await app.request('/api/manage/notifications/all/read', {
        method: 'POST',
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoMarkAllAsReadForAdmin).toHaveBeenCalled();
      expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          summary: 'Marked all notifications as read',
        })
      );
    });
  });
});
