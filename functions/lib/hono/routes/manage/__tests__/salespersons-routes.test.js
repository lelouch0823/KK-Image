import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoList: vi.fn(),
  repoFindById: vi.fn(),
  repoCreate: vi.fn(),
  repoUpdate: vi.fn(),
  repoDelete: vi.fn(),
  repoHasOrders: vi.fn(),
  repoResetAccessToken: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishSingleDomainEventAndPoll: vi.fn(),
}));

vi.mock('../../../../../repositories/SalespersonRepository.ts', () => ({
  SalespersonRepository: vi.fn(() => ({
    list: mocks.repoList,
    findById: mocks.repoFindById,
    create: mocks.repoCreate,
    update: mocks.repoUpdate,
    delete: mocks.repoDelete,
    hasOrders: mocks.repoHasOrders,
    resetAccessToken: mocks.repoResetAccessToken,
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
    parsePagination: vi.fn(() => ({ page: 1, limit: 50, offset: 0 })),
    requireEntity: async (promise, onNotFound) => {
      const entity = await promise;
      if (!entity) throw onNotFound();
      return entity;
    },
    scheduleCacheInvalidation: vi.fn(),
  };
});

vi.mock('../../_shared/cache-urls.js', () => ({
  getManageSalespersonCacheUrls: vi.fn(() => []),
}));

import salespersonsApp from '../salespersons.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/salespersons', salespersonsApp);
  return app;
}

const ENV = { DB: {}, JWT_SECRET: 'test-secret' };
const CTX = { waitUntil: vi.fn() };

describe('manage salespersons routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.repoList.mockResolvedValue({
      results: [
        { id: 'sp-1', name: '张三', store: '门店A', phone: '13800000000', access_token: 'tok-1', is_active: 1, order_count: 10, created_at: 1, updated_at: 1 },
      ],
      total: 1,
      pages: 1,
    });
    mocks.repoFindById.mockResolvedValue({
      id: 'sp-1', name: '张三', store: '门店A', phone: '13800000000', access_token: 'tok-1', is_active: 1, created_at: 1, updated_at: 1,
    });
    mocks.repoCreate.mockResolvedValue({ id: 'sp-new', name: '李四', store: '门店B', phone: '13900000000', access_token: 'tok-new' });
    mocks.repoUpdate.mockResolvedValue(true);
    mocks.repoDelete.mockResolvedValue(true);
    mocks.repoHasOrders.mockResolvedValue(false);
    mocks.repoResetAccessToken.mockResolvedValue('new-tok-123');
    mocks.scheduleAuditEvent.mockResolvedValue(undefined);
    mocks.publishSingleDomainEventAndPoll.mockResolvedValue(undefined);
  });

  describe('GET /', () => {
    it('返回销售人员列表', async () => {
      const res = await app.request('/api/manage/salespersons', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('张三');
      expect(json.pagination).toBeDefined();
    });
  });

  describe('POST /', () => {
    it('创建销售人员成功', async () => {
      const res = await app.request('/api/manage/salespersons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '李四', password: 'pass123', store: '门店B' }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('sp-new');
      expect(mocks.repoCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: '李四', store: '门店B' })
      );
    });

    it('缺少必填字段返回 400', async () => {
      const res = await app.request('/api/manage/salespersons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: '门店B' }),
      }, ENV, CTX);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /:id', () => {
    it('更新销售人员成功', async () => {
      const res = await app.request('/api/manage/salespersons/sp-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '张三改' }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoUpdate).toHaveBeenCalledWith('sp-1', expect.objectContaining({ name: '张三改' }));
    });

    it('销售人员不存在时返回 404', async () => {
      mocks.repoUpdate.mockResolvedValue(false);

      const res = await app.request('/api/manage/salespersons/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '不存在' }),
      }, ENV, CTX);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('删除销售人员成功', async () => {
      const res = await app.request('/api/manage/salespersons/sp-1', {
        method: 'DELETE',
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoDelete).toHaveBeenCalledWith('sp-1');
    });

    it('有关联订单时返回 400', async () => {
      mocks.repoHasOrders.mockResolvedValue(true);

      const res = await app.request('/api/manage/salespersons/sp-1', {
        method: 'DELETE',
      }, ENV, CTX);

      expect(res.status).toBe(400);
      expect(mocks.repoDelete).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/reset-token', () => {
    it('重置访问令牌成功', async () => {
      const res = await app.request('/api/manage/salespersons/sp-1/reset-token', {
        method: 'POST',
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBe('new-tok-123');
      expect(mocks.repoResetAccessToken).toHaveBeenCalledWith('sp-1');
    });

    it('销售人员不存在时返回 404', async () => {
      mocks.repoResetAccessToken.mockResolvedValue(null);

      const res = await app.request('/api/manage/salespersons/nonexistent/reset-token', {
        method: 'POST',
      }, ENV, CTX);

      expect(res.status).toBe(404);
    });
  });
});
