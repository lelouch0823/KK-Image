import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoFindAll: vi.fn(),
  repoFindById: vi.fn(),
  repoGetTree: vi.fn(),
  repoGetProductCounts: vi.fn(),
  repoCreate: vi.fn(),
  repoUpdate: vi.fn(),
  repoDelete: vi.fn(),
}));

vi.mock('../../../../../repositories/CategoryRepository.js', () => ({
  CategoryRepository: vi.fn(() => ({
    findAll: mocks.repoFindAll,
    findById: mocks.repoFindById,
    getTree: mocks.repoGetTree,
    getProductCounts: mocks.repoGetProductCounts,
    create: mocks.repoCreate,
    update: mocks.repoUpdate,
    delete: mocks.repoDelete,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

vi.mock('../../../../../_shared/utils.js', async () => {
  const actual = await vi.importActual('../../../../../_shared/utils.js');
  return {
    ...actual,
    generateId: vi.fn(() => 'cat-new'),
    now: vi.fn(() => 1700000000000),
  };
});

import categoriesApp from '../categories.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/categories', categoriesApp);
  return app;
}

const ENV = { DB: {} };
const CTX = { waitUntil: vi.fn() };

describe('manage categories routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.repoFindAll.mockResolvedValue([
      { id: 'cat-1', name: '服装', parent_id: null, sort_order: 0, created_at: 1 },
    ]);
    mocks.repoFindById.mockResolvedValue({ id: 'cat-1', name: '服装', parent_id: null, sort_order: 0, created_at: 1 });
    mocks.repoGetTree.mockResolvedValue([{ id: 'cat-1', name: '服装', children: [] }]);
    mocks.repoGetProductCounts.mockResolvedValue(new Map([['cat-1', 5]]));
    mocks.repoCreate.mockResolvedValue({ id: 'cat-new', name: '新品', parent_id: null, sort_order: 0 });
    mocks.repoUpdate.mockResolvedValue(undefined);
    mocks.repoDelete.mockResolvedValue(undefined);
  });

  describe('GET /', () => {
    it('返回分类列表及商品数量', async () => {
      const res = await app.request('/api/manage/categories', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].product_count).toBe(5);
    });

    it('mode=tree 时返回树结构', async () => {
      const res = await app.request('/api/manage/categories?mode=tree', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data[0].children).toBeDefined();
      expect(mocks.repoGetTree).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('创建分类成功', async () => {
      const res = await app.request('/api/manage/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新品' }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('cat-new');
      expect(mocks.repoCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: '新品', id: 'cat-new' })
      );
    });

    it('父分类不存在时返回 404', async () => {
      mocks.repoFindById.mockResolvedValueOnce(null);

      const res = await app.request('/api/manage/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '子分类', parent_id: 'nonexistent' }),
      }, ENV, CTX);

      expect(res.status).toBe(404);
    });

    it('缺少 name 时返回 400', async () => {
      const res = await app.request('/api/manage/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, ENV, CTX);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /:id', () => {
    it('更新分类成功', async () => {
      mocks.repoFindById
        .mockResolvedValueOnce({ id: 'cat-1', name: '服装' })
        .mockResolvedValueOnce({ id: 'cat-1', name: '服饰' });

      const res = await app.request('/api/manage/categories/cat-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '服饰' }),
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoUpdate).toHaveBeenCalledWith('cat-1', expect.objectContaining({ name: '服饰' }));
    });

    it('分类不存在时返回 404', async () => {
      mocks.repoFindById.mockResolvedValueOnce(null);

      const res = await app.request('/api/manage/categories/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新名' }),
      }, ENV, CTX);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('删除分类成功', async () => {
      const res = await app.request('/api/manage/categories/cat-1', {
        method: 'DELETE',
      }, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoDelete).toHaveBeenCalledWith('cat-1');
    });

    it('分类不存在时返回 404', async () => {
      mocks.repoFindById.mockResolvedValueOnce(null);

      const res = await app.request('/api/manage/categories/nonexistent', {
        method: 'DELETE',
      }, ENV, CTX);

      expect(res.status).toBe(404);
    });
  });
});
