import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoFindShared: vi.fn(),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findShared: mocks.repoFindShared,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    parsePagination: vi.fn(() => ({ page: 1, limit: 20, offset: 0 })),
  };
});

import sharesApp from '../shares.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/shares', sharesApp);
  return app;
}

const ENV = { DB: {} };
const CTX = { waitUntil: vi.fn() };

describe('manage shares routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.repoFindShared.mockResolvedValue({
      items: [
        {
          id: 'folder-1',
          name: '公共相册',
          share_token: 'tok-abc',
          is_public: 1,
          created_at: 1,
          share_expires_at: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  describe('GET /', () => {
    it('返回分享链接列表', async () => {
      const res = await app.request('/api/manage/shares', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('公共相册');
      expect(json.data[0].shareToken).toBe('tok-abc');
      expect(json.data[0].shareUrl).toBe('/gallery/tok-abc');
      expect(json.data[0].isPublic).toBe(true);
    });

    it('返回空列表', async () => {
      mocks.repoFindShared.mockResolvedValue({
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });

      const res = await app.request('/api/manage/shares', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
      expect(json.pagination.total).toBe(0);
    });

    it('包含分页信息', async () => {
      const res = await app.request('/api/manage/shares', undefined, ENV, CTX);
      const json = await res.json();

      expect(json.pagination).toBeDefined();
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.total).toBe(1);
      expect(json.pagination.totalPages).toBe(1);
    });
  });
});
