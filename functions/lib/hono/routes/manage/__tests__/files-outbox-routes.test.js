import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  fileFindById: vi.fn(),
  fileFindByIds: vi.fn(),
  fileUpdate: vi.fn(),
  fileSoftDelete: vi.fn(),
  fileSoftDeleteBatch: vi.fn(),
  fileMoveBatch: vi.fn(),
  fileCheckNameConflict: vi.fn(),
  fileFindConflictingNames: vi.fn(),
  folderFindById: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishSingleDomainEventAndPoll: vi.fn(async () => []),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findById: mocks.fileFindById,
    findByIds: mocks.fileFindByIds,
    update: mocks.fileUpdate,
    softDelete: mocks.fileSoftDelete,
    softDeleteBatch: mocks.fileSoftDeleteBatch,
    moveBatch: mocks.fileMoveBatch,
    checkNameConflict: mocks.fileCheckNameConflict,
    findConflictingNames: mocks.fileFindConflictingNames,
    findAll: vi.fn(async () => ({ items: [], page: 1, limit: 50, total: 0, totalPages: 0 })),
  })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findById: mocks.folderFindById,
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

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../_shared/domain-outbox.js', () => ({
  publishSingleDomainEventAndPoll: mocks.publishSingleDomainEventAndPoll,
}));

import filesApp from '../files.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/files', filesApp);
  return app;
}

describe('manage files outbox routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fileFindById.mockResolvedValue({
      id: 'file-1',
      name: 'hero.jpg',
      folder_id: 'folder-a',
      storage_key: 'hero-key',
      created_at: 1,
      updated_at: 1,
    });
    mocks.fileFindByIds.mockResolvedValue([
      { id: 'file-1', name: 'hero.jpg', folder_id: 'folder-a' },
      { id: 'file-2', name: 'detail.jpg', folder_id: 'folder-b' },
    ]);
    mocks.fileUpdate.mockResolvedValue(undefined);
    mocks.fileSoftDelete.mockResolvedValue(undefined);
    mocks.fileSoftDeleteBatch.mockResolvedValue(undefined);
    mocks.fileMoveBatch.mockResolvedValue(undefined);
    mocks.fileCheckNameConflict.mockResolvedValue(false);
    mocks.fileFindConflictingNames.mockResolvedValue([]);
    mocks.folderFindById.mockResolvedValue({ id: 'folder-target', name: 'Target Folder' });
  });

  it('publishes file-updated outbox events when renaming through manage files', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/files/file-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'hero-renamed.jpg' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'file_updated',
        aggregate_type: 'file',
        aggregate_id: 'file-1',
        payload: expect.objectContaining({
          file_id: 'file-1',
          folder_ids: ['folder-a'],
        }),
      }),
      expect.any(String)
    );
  });

  it('publishes file-deleted outbox events when soft deleting through manage files', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/files/file-1',
      { method: 'DELETE' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'file_deleted',
        aggregate_type: 'file',
        aggregate_id: 'file-1',
        payload: expect.objectContaining({
          file_id: 'file-1',
          folder_ids: ['folder-a'],
        }),
      }),
      expect.any(String)
    );
  });

  it('publishes batch-delete outbox events when manage files deletes multiple records', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/files/batch/delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['file-1', 'file-2'] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'file_batch_deleted',
        aggregate_type: 'file',
        payload: expect.objectContaining({
          file_ids: ['file-1', 'file-2'],
          folder_ids: ['folder-a', 'folder-b'],
        }),
      }),
      expect.any(String)
    );
  });

  it('publishes batch-move outbox events when manage files moves records between folders', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/files/batch/move',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['file-1', 'file-2'], targetFolderId: 'folder-target' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'file_batch_moved',
        aggregate_type: 'file',
        payload: expect.objectContaining({
          file_ids: ['file-1', 'file-2'],
          folder_ids: ['folder-a', 'folder-b', 'folder-target'],
        }),
      }),
      expect.any(String)
    );
  });
});
