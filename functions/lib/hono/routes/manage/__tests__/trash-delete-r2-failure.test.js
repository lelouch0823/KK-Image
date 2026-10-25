import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  fileDeleteBatch: vi.fn(),
  fileFindTrash: vi.fn(async () => []),
  folderFindTrash: vi.fn(async () => []),
  folderFindById: vi.fn(async () => null),
  folderGetAllFilesRecursive: vi.fn(async () => []),
  folderDeleteRecursive: vi.fn(),
  decrementRefCount: vi.fn(async () => false),
  scheduleAuditEvent: vi.fn(),
  publishDomainEventsAndPoll: vi.fn(async () => []),
  invalidateCache: vi.fn(async () => {}),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findTrash: mocks.fileFindTrash,
    deleteBatch: mocks.fileDeleteBatch,
  })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findTrash: mocks.folderFindTrash,
    findById: mocks.folderFindById,
    getAllFilesRecursive: mocks.folderGetAllFilesRecursive,
    deleteRecursive: mocks.folderDeleteRecursive,
  })),
}));

vi.mock('../../../../../api/utils/blob-utils.js', () => ({
  decrementRefCount: mocks.decrementRefCount,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => {
    await next();
  },
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => {
    await next();
  },
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../_shared/domain-outbox.js', () => ({
  publishDomainEventsAndPoll: mocks.publishDomainEventsAndPoll,
}));

import trashApp from '../trash.js';

function createEnvDb({ fileRows = [], folderFileIds = [] } = {}) {
  return {
    prepare: vi.fn((sql) => {
      const normalized = String(sql);
      return {
        bind: () => ({
          all: async () => {
            if (normalized.includes('WHERE id IN')) return { results: fileRows };
            if (normalized.includes('WHERE folder_id = ?')) {
              return { results: folderFileIds.map((id) => ({ id })) };
            }
            return { results: [] };
          },
          run: async () => ({ success: true }),
        }),
      };
    }),
  };
}

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/trash', trashApp);
  return app;
}

function createR2({ failOn = null } = {}) {
  return {
    delete: vi.fn(async (key) => {
      if (failOn && (failOn === '*' || failOn === key)) {
        throw new Error('R2 internal error');
      }
      return {};
    }),
  };
}

describe('trash delete/empty R2 failure semantics (B-M6)', () => {
  let executionCtx;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fileFindTrash.mockResolvedValue([]);
    mocks.folderFindById.mockResolvedValue(null);
    mocks.folderGetAllFilesRecursive.mockResolvedValue([]);
    mocks.fileDeleteBatch.mockResolvedValue(undefined);
    mocks.folderDeleteRecursive.mockResolvedValue(undefined);
    mocks.decrementRefCount.mockResolvedValue(false);
    executionCtx = { waitUntil: vi.fn() };
  });

  describe('POST /delete', () => {
    it('claims rows first, then surfaces R2 failure for folder fallback keys (C-F1, resumable retry)', async () => {
      mocks.folderFindById.mockResolvedValue({ id: 'folder-a', deleted_at: 100 });
      mocks.folderGetAllFilesRecursive.mockResolvedValue([
        { id: 'file-1', content_hash: null, storage_key: 'folders/a/1.png' },
        { id: 'file-2', content_hash: null, storage_key: 'folders/a/2.png' },
      ]);
      const r2 = createR2({ failOn: 'folders/a/2.png' });
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: [], folderIds: ['folder-a'] }),
        },
        env,
        executionCtx
      );

      // C-F1：与文件分支 B13 同序——deleteRecursive 先认领台账行，再逐文件
      // 清对象；R2 失败向上抛出，对象泄漏方向保守（可对账重试）
      expect(res.status).toBe(500);
      expect(mocks.folderDeleteRecursive).toHaveBeenCalledWith('folder-a');
      expect(mocks.decrementRefCount).not.toHaveBeenCalled();
      expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
    });

    it('deletes shared-CAS blob files via refcount claims, never bare R2 deletes (C-F1)', async () => {
      mocks.folderFindById.mockResolvedValue({ id: 'folder-a', deleted_at: 100 });
      // 同一 content_hash 被子树内两个文件共享，另有一个无 hash 的 fallback key
      mocks.folderGetAllFilesRecursive.mockResolvedValue([
        { id: 'file-1', content_hash: 'hash-1', storage_key: 'hash-1' },
        { id: 'file-2', content_hash: 'hash-1', storage_key: 'hash-1' },
        { id: 'file-3', content_hash: null, storage_key: 'fallback-1' },
      ]);
      const r2 = createR2();
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: [], folderIds: ['folder-a'] }),
        },
        env,
        executionCtx
      );

      expect(res.status).toBe(200);
      expect(mocks.folderDeleteRecursive).toHaveBeenCalledWith('folder-a');
      // 共享 blob 走引用认领（每个文件行扣一次），不裸删共享对象
      expect(mocks.decrementRefCount).toHaveBeenCalledTimes(2);
      expect(mocks.decrementRefCount).toHaveBeenNthCalledWith(1, env, 'hash-1');
      expect(mocks.decrementRefCount).toHaveBeenNthCalledWith(2, env, 'hash-1');
      // 仅独占的 fallback key 直接删 R2
      expect(r2.delete).toHaveBeenCalledTimes(1);
      expect(r2.delete).toHaveBeenCalledWith('fallback-1');
    });

    it('surfaces refcount claim failure for shared blobs (tombstone keeps retry entry)', async () => {
      mocks.folderFindById.mockResolvedValue({ id: 'folder-a', deleted_at: 100 });
      mocks.folderGetAllFilesRecursive.mockResolvedValue([
        { id: 'file-1', content_hash: 'hash-1', storage_key: 'hash-1' },
      ]);
      mocks.decrementRefCount.mockRejectedValue(new Error('R2 internal error'));
      const r2 = createR2();
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: [], folderIds: ['folder-a'] }),
        },
        env,
        executionCtx
      );

      expect(res.status).toBe(500);
      expect(mocks.folderDeleteRecursive).toHaveBeenCalledWith('folder-a');
      // 共享对象未被裸删（认领失败跳过对象删除）
      expect(r2.delete).not.toHaveBeenCalled();
    });

    it('claims the DB row first, then surfaces R2 failure (resumable retry, B13)', async () => {
      const r2 = createR2({ failOn: 'files/1.png' });
      const env = {
        DB: createEnvDb({ fileRows: [{ id: 'file-1', storage_key: 'files/1.png', content_hash: null, deleted_at: 1 }] }),
        R2_BUCKET: r2,
      };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: ['file-1'], folderIds: [] }),
        },
        env,
        executionCtx
      );

      // B13：行删除是认领（重试时 SELECT 不再返回该行，天然幂等）；
      // R2 失败向上抛出，对象泄漏方向保守（可对账），不产生
      // "对象已删、行仍在 → 重试双重扣减引用"的旧风险
      expect(res.status).toBe(500);
      expect(mocks.fileDeleteBatch).toHaveBeenCalledWith(['file-1']);
      expect(r2.delete).toHaveBeenCalledWith('files/1.png');
    });

    it('claims the DB row first, then surfaces blob refcount failure (B13)', async () => {
      mocks.decrementRefCount.mockRejectedValue(new Error('R2 internal error'));
      const env = {
        DB: createEnvDb({ fileRows: [{ id: 'file-1', storage_key: 'hash-1', content_hash: 'hash-1', deleted_at: 1 }] }),
        R2_BUCKET: createR2(),
      };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: ['file-1'], folderIds: [] }),
        },
        env,
        executionCtx
      );

      expect(res.status).toBe(500);
      expect(mocks.fileDeleteBatch).toHaveBeenCalledWith(['file-1']);
    });

    it('silently skips active (non-trashed) file ids — trash-only lifecycle guard (B5)', async () => {
      const r2 = createR2();
      const env = {
        // SELECT 的 deleted_at IS NOT NULL 过滤在真实 DB 生效；mock 直接
        // 返回空（模拟活跃 id 被过滤后的结果）
        DB: createEnvDb({ fileRows: [] }),
        R2_BUCKET: r2,
      };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: ['file-1'], folderIds: [] }),
        },
        env,
        executionCtx
      );

      expect(res.status).toBe(200);
      expect(mocks.fileDeleteBatch).not.toHaveBeenCalled();
      expect(r2.delete).not.toHaveBeenCalled();
    });

    it('keeps deleting DB records when R2 objects are missing (idempotent delete)', async () => {
      mocks.folderFindById.mockResolvedValue({ id: 'folder-a', deleted_at: 100 });
      mocks.folderGetAllFilesRecursive.mockResolvedValue([
        { id: 'file-1', content_hash: null, storage_key: 'files/gone.png' },
      ]);
      const r2 = createR2();
      const env = {
        DB: createEnvDb({
          fileRows: [{ id: 'file-1', storage_key: 'files/gone.png', content_hash: null, deleted_at: 1 }],
        }),
        R2_BUCKET: r2,
      };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: ['file-1'], folderIds: ['folder-a'] }),
        },
        env,
        executionCtx
      );

      expect(res.status).toBe(200);
      expect(mocks.fileDeleteBatch).toHaveBeenCalledWith(['file-1']);
      expect(mocks.folderDeleteRecursive).toHaveBeenCalledWith('folder-a');
    });
  });

  describe('DELETE /empty', () => {
    it('claims DB rows first, then surfaces R2 failure (resumable retry, B13)', async () => {
      mocks.fileFindTrash.mockResolvedValue([
        { id: 'file-1', storage_key: 'files/1.png', content_hash: null, deleted_at: 1 },
      ]);
      const r2 = createR2({ failOn: '*' });
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/empty',
        { method: 'DELETE' },
        env,
        executionCtx
      );

      expect(res.status).toBe(500);
      expect(mocks.fileDeleteBatch).toHaveBeenCalledWith(['file-1']);
      expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
    });

    it('claims rows first, then surfaces R2 failure for a trashed folder fallback key (C-F1)', async () => {
      mocks.folderFindTrash.mockResolvedValue([{ id: 'folder-a' }]);
      mocks.folderFindById.mockResolvedValue({ id: 'folder-a', deleted_at: 100 });
      mocks.folderGetAllFilesRecursive.mockResolvedValue([
        { id: 'file-1', content_hash: null, storage_key: 'folders/a/1.png' },
      ]);
      const r2 = createR2({ failOn: 'folders/a/1.png' });
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/empty',
        { method: 'DELETE' },
        env,
        executionCtx
      );

      expect(res.status).toBe(500);
      expect(mocks.folderDeleteRecursive).toHaveBeenCalledWith('folder-a');
      expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
    });
  });
});

describe('trash cache invalidation', () => {
  let executionCtx;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fileFindTrash.mockResolvedValue([]);
    mocks.folderFindById.mockResolvedValue(null);
    mocks.folderGetAllFilesRecursive.mockResolvedValue([]);
    executionCtx = { waitUntil: vi.fn() };
  });

  it('schedules trash-scope invalidation after a successful restore', async () => {
    const env = { DB: createEnvDb() };

    await createApp().request(
      'http://localhost/api/manage/trash/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: [], folderIds: [] }),
      },
      env,
      executionCtx
    );

    expect(mocks.invalidateCache).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('/api/manage/trash')]),
      env
    );
  });

  it('schedules trash-scope invalidation after a successful delete', async () => {
    const env = {
      DB: createEnvDb({ fileRows: [{ id: 'file-1', storage_key: 'files/1.png', content_hash: null, deleted_at: 1 }] }),
      R2_BUCKET: createR2(),
    };

    await createApp().request(
      'http://localhost/api/manage/trash/delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ['file-1'], folderIds: [] }),
      },
      env,
      executionCtx
    );

    expect(mocks.invalidateCache).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('/api/manage/trash')]),
      env
    );
  });

  it('schedules trash-scope invalidation after a successful empty', async () => {
    const env = { DB: createEnvDb(), R2_BUCKET: createR2() };

    await createApp().request(
      'http://localhost/api/manage/trash/empty',
      { method: 'DELETE' },
      env,
      executionCtx
    );

    expect(mocks.invalidateCache).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('/api/manage/trash')]),
      env
    );
  });
});
