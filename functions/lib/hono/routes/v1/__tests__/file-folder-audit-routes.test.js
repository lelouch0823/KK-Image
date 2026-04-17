import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const fileMocks = vi.hoisted(() => ({
  fileFindById: vi.fn(),
  fileFindByIds: vi.fn(),
  fileFindByOriginalHash: vi.fn(),
  fileSoftDelete: vi.fn(),
  fileSoftDeleteBatch: vi.fn(),
  fileMoveBatch: vi.fn(),
  fileCreate: vi.fn(),
  fileUpdate: vi.fn(),
  fileFindConflictingNames: vi.fn(),
  folderFindById: vi.fn(),
  folderCanDelete: vi.fn(),
  folderSoftDelete: vi.fn(),
  folderFindDetail: vi.fn(),
  folderList: vi.fn(),
  folderCreate: vi.fn(),
  folderCheckNameConflict: vi.fn(),
  folderUpdate: vi.fn(),
  folderUpdateShareSettings: vi.fn(),
  folderIsDescendantOrSelf: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findById: fileMocks.fileFindById,
    findByIds: fileMocks.fileFindByIds,
    findByOriginalHash: fileMocks.fileFindByOriginalHash,
    softDelete: fileMocks.fileSoftDelete,
    softDeleteBatch: fileMocks.fileSoftDeleteBatch,
    moveBatch: fileMocks.fileMoveBatch,
    checkNameConflict: vi.fn(async () => false),
    update: fileMocks.fileUpdate,
    create: fileMocks.fileCreate,
    findConflictingNames: fileMocks.fileFindConflictingNames,
    findAll: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
  })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findById: fileMocks.folderFindById,
    canDelete: fileMocks.folderCanDelete,
    softDelete: fileMocks.folderSoftDelete,
    updateShareSettings: fileMocks.folderUpdateShareSettings,
    findDetail: fileMocks.folderFindDetail,
    list: fileMocks.folderList,
    create: fileMocks.folderCreate,
    checkNameConflict: fileMocks.folderCheckNameConflict,
    update: fileMocks.folderUpdate,
    isDescendantOrSelf: fileMocks.folderIsDescendantOrSelf,
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
    fileMocks.fileFindByOriginalHash.mockResolvedValue(null);
    fileMocks.fileSoftDelete.mockResolvedValue(undefined);
    fileMocks.fileSoftDeleteBatch.mockResolvedValue(undefined);
    fileMocks.fileMoveBatch.mockResolvedValue(undefined);
    fileMocks.fileCreate.mockResolvedValue(undefined);
    fileMocks.fileUpdate.mockResolvedValue(undefined);
    fileMocks.fileFindConflictingNames.mockResolvedValue([]);
    fileMocks.folderFindById.mockResolvedValue({ id: 'folder-1', name: 'Folder One', parent_id: 'root' });
    fileMocks.folderCanDelete.mockResolvedValue({ canDelete: true });
    fileMocks.folderSoftDelete.mockResolvedValue(undefined);
    fileMocks.folderFindDetail.mockResolvedValue({
      folder: { id: 'folder-1', name: 'Folder One', parent_id: 'root', is_public: 0, password: null, share_expires_at: null },
      files: [{ id: 'file-1', name: 'File One', storage_key: 'storage-1', size: 12, mime_type: 'image/png', created_at: 1 }],
      subfolders: [{ id: 'folder-2', name: 'Child', parent_id: 'folder-1', is_public: 0, password: null, share_expires_at: null }],
    });
    fileMocks.folderList.mockResolvedValue({
      items: [{ id: 'folder-1', name: 'Folder One', parent_id: 'root', subfolder_count: 2, file_count: 3, is_public: 0, password: null, share_expires_at: null }],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    fileMocks.folderCreate.mockResolvedValue(undefined);
    fileMocks.folderCheckNameConflict.mockResolvedValue(false);
    fileMocks.folderUpdate.mockResolvedValue(undefined);
    fileMocks.folderUpdateShareSettings.mockResolvedValue({ share_token: 'share-token', is_public: 1, password: 'pw', share_expires_at: '2026-12-31' });
    fileMocks.folderIsDescendantOrSelf.mockResolvedValue(false);
    fileMocks.scheduleCacheInvalidation.mockImplementation(() => {});
  });

  it('lists v1 files with pagination and safe file payloads', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/files', v1FilesApp);
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) {
          return {
            bind: vi.fn(() => ({
              first: vi.fn(async () => ({ total: 1 })),
            })),
          };
        }
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [{ id: 'file-1', name: 'File One', storage_key: 'storage-1', size: 12, folder_id: 'root', mime_type: 'image/png', created_at: 1, updated_at: 2 }],
            })),
          })),
        };
      }),
    };

    const res = await app.request('http://localhost/api/v1/files?page=2&limit=5&sort=name&order=asc&search=file', {}, { DB: db });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    expect(body.data).toEqual([
      expect.objectContaining({
        id: 'file-1',
        folderId: 'root',
        url: '/file/file-1',
      }),
    ]);
  });

  it('returns instant-upload metadata when original hash already exists', async () => {
    fileMocks.fileFindByOriginalHash.mockResolvedValueOnce({
      id: 'file-9',
      name: 'Existing',
      mime_type: 'image/png',
      size: 128,
    });
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/files', v1FilesApp);

    const res = await app.request(
      'http://localhost/api/v1/files/check-hash',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_hash: 'abc123' }),
      },
      { DB: {} }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(expect.objectContaining({
      exists: true,
      file: expect.objectContaining({ id: 'file-9', instantUpload: true }),
    }));
  });

  it('creates and updates v1 file records through repository-backed routes', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/files', v1FilesApp);
    const waitUntil = vi.fn();

    const createRes = await app.request(
      'http://localhost/api/v1/files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Created File', folderId: 'folder-1', isPublic: true }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(createRes.status).toBe(201);
    expect(fileMocks.fileCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Created File',
      folderId: 'folder-1',
      isPublic: true,
    }));
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({ event_type: 'v1_file_created' }),
    ], undefined);

    const updateRes = await app.request(
      'http://localhost/api/v1/files/file-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed File', folderId: 'folder-1', isPublic: true }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(updateRes.status).toBe(200);
    expect(fileMocks.fileUpdate).toHaveBeenCalledWith('file-1', {
      name: 'Renamed File',
      folder_id: 'folder-1',
      is_public: 1,
    });
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({ event_type: 'v1_file_updated' }),
    ], undefined);
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('moves v1 files in batch after target-folder validation', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/files', v1FilesApp);
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/v1/files/batch/move',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['file-1'], targetFolderId: 'folder-1' }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(fileMocks.fileMoveBatch).toHaveBeenCalledWith(['file-1'], 'folder-1');
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'v1_file_batch_moved',
        payload: expect.objectContaining({
          file_ids: ['file-1'],
          folder_ids: ['root', 'folder-1'],
        }),
      }),
    ], undefined);
    expect(waitUntil).toHaveBeenCalledTimes(1);
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

  it('lists folder summaries and expands folder detail payloads', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/folders', v1FoldersApp);

    const listRes = await app.request('http://localhost/api/v1/folders?page=1&limit=20', {}, { DB: {} });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data).toEqual([
      expect.objectContaining({
        id: 'folder-1',
        parentId: 'root',
        subfolderCount: 2,
        fileCount: 3,
      }),
    ]);

    const detailRes = await app.request('http://localhost/api/v1/folders/folder-1', {}, { DB: {} });
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.data).toEqual(expect.objectContaining({
      id: 'folder-1',
      files: [expect.objectContaining({ id: 'file-1', url: '/file/file-1' })],
      subfolders: [expect.objectContaining({ id: 'folder-2' })],
    }));
  });

  it('creates, updates, and shares folders through repository-backed routes', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/v1/folders', v1FoldersApp);
    const waitUntil = vi.fn();

    const createRes = await app.request(
      'http://localhost/api/v1/folders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Folder', parentId: 'folder-1', isPublic: false }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(createRes.status).toBe(201);
    expect(fileMocks.folderCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Folder',
      parentId: 'folder-1',
    }));
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({ event_type: 'v1_folder_created' }),
    ], undefined);

    const updateRes = await app.request(
      'http://localhost/api/v1/folders/folder-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Folder Renamed', description: 'desc', isPublic: true }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(updateRes.status).toBe(200);
    expect(fileMocks.folderUpdate).toHaveBeenCalledWith(
      'folder-1',
      ['name = ?', 'description = ?', 'is_public = ?', 'updated_at = ?'],
      ['Folder Renamed', 'desc', 1, expect.any(Number)]
    );
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({ event_type: 'v1_folder_updated' }),
    ], undefined);

    const shareRes = await app.request(
      'http://localhost/api/v1/folders/folder-1/share',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: true, password: 'pass', expiresAt: '2026-12-31T00:00:00.000Z' }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(shareRes.status).toBe(200);
    expect(fileMocks.folderUpdateShareSettings).toHaveBeenCalledWith('folder-1', {
      isPublic: true,
      password: 'pass',
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const shareBody = await shareRes.json();
    expect(shareBody.data).toEqual({
      shareToken: 'share-token',
      isPublic: true,
      hasPassword: true,
      expiresAt: '2026-12-31',
    });
    expect(fileMocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({ event_type: 'v1_folder_share_updated' }),
    ], undefined);
    expect(waitUntil).toHaveBeenCalledTimes(3);
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
