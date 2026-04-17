import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const fileMocks = vi.hoisted(() => ({
  fileFindById: vi.fn(),
  fileFindByIds: vi.fn(),
  fileSoftDelete: vi.fn(),
  fileSoftDeleteBatch: vi.fn(),
  fileMoveBatch: vi.fn(),
  folderFindById: vi.fn(),
  folderCanDelete: vi.fn(),
  folderSoftDelete: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findById: fileMocks.fileFindById,
    findByIds: fileMocks.fileFindByIds,
    softDelete: fileMocks.fileSoftDelete,
    softDeleteBatch: fileMocks.fileSoftDeleteBatch,
    moveBatch: fileMocks.fileMoveBatch,
    checkNameConflict: vi.fn(async () => false),
    update: vi.fn(async () => undefined),
    create: vi.fn(async () => undefined),
    findConflictingNames: vi.fn(async () => []),
    findAll: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
  })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findById: fileMocks.folderFindById,
    canDelete: fileMocks.folderCanDelete,
    softDelete: fileMocks.folderSoftDelete,
    updateShareSettings: vi.fn(async () => ({ share_token: null, is_public: 0, password: null, share_expires_at: null })),
    findDetail: vi.fn(async () => ({ folder: {}, files: [], subfolders: [] })),
    list: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    create: vi.fn(async () => undefined),
    checkNameConflict: vi.fn(async () => false),
    update: vi.fn(async () => undefined),
    isDescendantOrSelf: vi.fn(async () => false),
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  },
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../cache-urls.js', () => ({
  getV1FileAndFolderCacheUrls: vi.fn(() => ['http://localhost/api/v1/files']),
  getV1FolderAndShareCacheUrls: vi.fn(() => ['http://localhost/api/v1/folders']),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    scheduleCacheInvalidation: fileMocks.scheduleCacheInvalidation,
    requireEntity: async (promise, onNotFound) => {
      const entity = await promise;
      if (!entity) throw onNotFound();
      return entity;
    },
  };
});

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: fileMocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: fileMocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: fileMocks.runOutboxPoller,
}));

vi.mock('../../../_shared/utils.js', () => ({
  getFileUrl: vi.fn((key) => `/file/${key}`),
  generateId: vi.fn(() => 'generated-id'),
  generateShareToken: vi.fn(() => 'share-token'),
  now: vi.fn(() => 1000),
  MSG: {
    FILE: {
      NOT_FOUND: 'FILE_NOT_FOUND',
      DELETE_SUCCESS: 'DELETE_SUCCESS',
      BATCH_DELETE_SUCCESS: 'BATCH_DELETE_SUCCESS {count}',
      MOVE_SUCCESS: 'MOVE_SUCCESS {count}',
      UPDATE_SUCCESS: 'UPDATE_SUCCESS',
    },
    FOLDER: {
      NOT_FOUND: 'FOLDER_NOT_FOUND',
      DELETE_SUCCESS: 'FOLDER_DELETE_SUCCESS',
      EMPTY_INVALID: 'EMPTY_INVALID',
      UPDATE_SUCCESS: 'UPDATE_SUCCESS',
      PARENT_NOT_FOUND: 'PARENT_NOT_FOUND',
    },
    COMMON: {
      NO_UPDATE_FIELDS: 'NO_UPDATE_FIELDS',
    },
  },
}));

import v1FilesApp from '../files.js';
import v1FoldersApp from '../folders.js';

describe('v1 file and folder audit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileMocks.fileFindById.mockResolvedValue({ id: 'file-1', name: 'File One', folder_id: 'root' });
    fileMocks.fileFindByIds.mockResolvedValue([{ id: 'file-1', name: 'File One', folder_id: 'root' }]);
    fileMocks.fileSoftDelete.mockResolvedValue(undefined);
    fileMocks.fileSoftDeleteBatch.mockResolvedValue(undefined);
    fileMocks.fileMoveBatch.mockResolvedValue(undefined);
    fileMocks.folderFindById.mockResolvedValue({ id: 'folder-1', name: 'Folder One', parent_id: 'root' });
    fileMocks.folderCanDelete.mockResolvedValue({ canDelete: true });
    fileMocks.folderSoftDelete.mockResolvedValue(undefined);
    fileMocks.scheduleCacheInvalidation.mockImplementation(() => {});
  });

  it('audits v1 file deletion and batch deletion', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/files', v1FilesApp);

    const waitUntil = vi.fn();
    const deleteRes = await app.request(
      'http://localhost/api/v1/files/file-1',
      { method: 'DELETE' },
      { DB: {} },
      { waitUntil }
    );
    expect(deleteRes.status).toBe(200);

    const batchRes = await app.request(
      'http://localhost/api/v1/files/batch/delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['file-1'] }),
      },
      { DB: {} },
      { waitUntil }
    );
    expect(batchRes.status).toBe(200);
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'v1_file_deleted',
        aggregate_type: 'file',
        aggregate_id: 'file-1',
      }),
    ], undefined);
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'v1_file_batch_deleted',
        aggregate_type: 'file',
      }),
    ], undefined);
    expect(fileMocks.runOutboxPoller).toHaveBeenCalledTimes(2);
    expect(waitUntil).toHaveBeenCalledTimes(2);

    expect(fileMocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'v1.file.delete',
        targetId: 'file-1',
        target_label: 'File One',
      })
    );
    expect(fileMocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'v1.file.batch_delete',
        metadata: { count: 1 },
      })
    );
  });

  it('audits v1 folder deletion as a critical operation', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/folders', v1FoldersApp);

    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/v1/folders/folder-1',
      { method: 'DELETE' },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'v1_folder_deleted',
        aggregate_type: 'folder',
        aggregate_id: 'folder-1',
      }),
    ], undefined);
    expect(fileMocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(fileMocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'v1.folder.delete',
        severity: 'critical',
        targetId: 'folder-1',
        target_label: 'Folder One',
      })
    );
  });
});
