import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  fileDeleteBatch: vi.fn(),
  fileFindTrash: vi.fn(async () => []),
  folderFindTrash: vi.fn(async () => []),
  folderFindById: vi.fn(async () => null),
  folderGetAllStorageKeysRecursive: vi.fn(async () => []),
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
    getAllStorageKeysRecursive: mocks.folderGetAllStorageKeysRecursive,
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
    mocks.folderGetAllStorageKeysRecursive.mockResolvedValue([]);
    mocks.fileDeleteBatch.mockResolvedValue(undefined);
    mocks.folderDeleteRecursive.mockResolvedValue(undefined);
    mocks.decrementRefCount.mockResolvedValue(false);
    executionCtx = { waitUntil: vi.fn() };
  });

  describe('POST /delete', () => {
    it('aborts before deleteRecursive when a folder R2 object fails to delete', async () => {
      mocks.folderGetAllStorageKeysRecursive.mockResolvedValue(['folders/a/1.png', 'folders/a/2.png']);
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

      expect(res.status).toBe(500);
      expect(r2.delete).toHaveBeenCalledTimes(2);
      expect(mocks.folderDeleteRecursive).not.toHaveBeenCalled();
      expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
    });

    it('aborts before deleteBatch when a plain file R2 object fails to delete', async () => {
      const r2 = createR2({ failOn: 'files/1.png' });
      const env = {
        DB: createEnvDb({ fileRows: [{ storage_key: 'files/1.png', content_hash: null }] }),
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

      expect(res.status).toBe(500);
      expect(mocks.fileDeleteBatch).not.toHaveBeenCalled();
    });

    it('aborts before deleteBatch when the CAS blob R2 object fails to delete', async () => {
      mocks.decrementRefCount.mockRejectedValue(new Error('R2 internal error'));
      const env = {
        DB: createEnvDb({ fileRows: [{ storage_key: 'hash-1', content_hash: 'hash-1' }] }),
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
      expect(mocks.fileDeleteBatch).not.toHaveBeenCalled();
    });

    it('keeps deleting DB records when R2 objects are missing (idempotent delete)', async () => {
      const r2 = createR2();
      const env = {
        DB: createEnvDb({
          fileRows: [{ storage_key: 'files/gone.png', content_hash: null }],
          folderFileIds: ['file-1'],
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
    it('aborts before deleteBatch when a trashed file R2 object fails to delete', async () => {
      mocks.fileFindTrash.mockResolvedValue([{ id: 'file-1', storage_key: 'files/1.png' }]);
      const r2 = createR2({ failOn: '*' });
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/empty',
        { method: 'DELETE' },
        env,
        executionCtx
      );

      expect(res.status).toBe(500);
      expect(mocks.fileDeleteBatch).not.toHaveBeenCalled();
      expect(mocks.scheduleAuditEvent).not.toHaveBeenCalled();
    });

    it('aborts before deleteRecursive when a trashed folder R2 object fails to delete', async () => {
      mocks.folderFindTrash.mockResolvedValue([{ id: 'folder-a' }]);
      mocks.folderFindById.mockResolvedValue({ id: 'folder-a' });
      mocks.folderGetAllStorageKeysRecursive.mockResolvedValue(['folders/a/1.png']);
      const r2 = createR2({ failOn: 'folders/a/1.png' });
      const env = { DB: createEnvDb(), R2_BUCKET: r2 };

      const res = await createApp().request(
        'http://localhost/api/manage/trash/empty',
        { method: 'DELETE' },
        env,
        executionCtx
      );

      expect(res.status).toBe(500);
      expect(mocks.folderDeleteRecursive).not.toHaveBeenCalled();
    });
  });
});

describe('trash cache invalidation', () => {
  let executionCtx;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fileFindTrash.mockResolvedValue([]);
    mocks.folderFindById.mockResolvedValue(null);
    mocks.folderGetAllStorageKeysRecursive.mockResolvedValue([]);
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
      DB: createEnvDb({ fileRows: [{ storage_key: 'files/1.png', content_hash: null }] }),
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
