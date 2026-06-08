import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoFindAll: vi.fn(),
  repoCreate: vi.fn(),
  repoAssignToFile: vi.fn(),
  repoRemoveFromFile: vi.fn(),
  repoSuggest: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishSingleDomainEventAndPoll: vi.fn(),
}));

vi.mock('../../../../../repositories/TagRepository.js', () => ({
  TagRepository: vi.fn(() => ({
    findAll: mocks.repoFindAll,
    create: mocks.repoCreate,
    assignToFile: mocks.repoAssignToFile,
    removeFromFile: mocks.repoRemoveFromFile,
    suggest: mocks.repoSuggest,
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
    generateId: vi.fn(() => 'tag-new'),
    now: vi.fn(() => 1700000000000),
  };
});

vi.mock('../../../_shared/audit-helpers.js', () => ({
  scheduleAuditEvent: (...args) => mocks.scheduleAuditEvent(...args),
}));

vi.mock('../../../_shared/domain-outbox.js', () => ({
  publishSingleDomainEventAndPoll: (...args) => mocks.publishSingleDomainEventAndPoll(...args),
}));

import tagsApp from '../tags.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/tags', tagsApp);
  return app;
}

const ENV = { DB: {} };
const CTX = { waitUntil: vi.fn() };

describe('manage tags routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.repoFindAll.mockResolvedValue([
      { id: 'tag-1', name: '风景', color: '#4CAF50', created_at: 1 },
      { id: 'tag-2', name: '人像', color: '#2196F3', created_at: 2 },
    ]);
    mocks.repoCreate.mockResolvedValue(undefined);
    mocks.repoAssignToFile.mockResolvedValue(undefined);
    mocks.repoRemoveFromFile.mockResolvedValue(undefined);
    mocks.repoSuggest.mockResolvedValue([{ id: 'tag-1', name: '风景', color: '#4CAF50' }]);
    mocks.scheduleAuditEvent.mockResolvedValue(undefined);
    mocks.publishSingleDomainEventAndPoll.mockResolvedValue(undefined);
  });

  describe('GET /', () => {
    it('返回所有标签列表', async () => {
      const res = await app.request('/api/manage/tags', undefined, ENV, CTX);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe('风景');
    });
  });

  describe('POST /', () => {
    it('创建标签成功', async () => {
      const res = await app.request(
        '/api/manage/tags',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '风景', color: '#4CAF50' }),
        },
        ENV,
        CTX
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('tag-new');
      expect(json.data.name).toBe('风景');
      expect(mocks.repoCreate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tag-new', name: '风景', color: '#4CAF50' })
      );
    });

    it('标签名重复时返回 409', async () => {
      mocks.repoCreate.mockRejectedValue(new Error('UNIQUE constraint failed'));

      const res = await app.request(
        '/api/manage/tags',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '风景' }),
        },
        ENV,
        CTX
      );

      expect(res.status).toBe(409);
    });

    it('缺少 name 时返回 400', async () => {
      const res = await app.request(
        '/api/manage/tags',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        ENV,
        CTX
      );

      expect(res.status).toBe(400);
    });
  });

  describe('POST /assign', () => {
    it('分配标签到文件成功', async () => {
      const res = await app.request(
        '/api/manage/tags/assign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: 'file-1', tag_id: 'tag-1' }),
        },
        ENV,
        CTX
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoAssignToFile).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'file-1', tagId: 'tag-1' })
      );
    });
  });

  describe('DELETE /assign', () => {
    it('从文件移除标签成功', async () => {
      const res = await app.request(
        '/api/manage/tags/assign',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: 'file-1', tag_id: 'tag-1' }),
        },
        ENV,
        CTX
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mocks.repoRemoveFromFile).toHaveBeenCalledWith('file-1', 'tag-1');
    });
  });
});
