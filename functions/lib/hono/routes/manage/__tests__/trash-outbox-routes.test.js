import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  fileFindByIds: vi.fn(),
  fileRestoreBatch: vi.fn(),
  folderFindById: vi.fn(),
  folderRestore: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishDomainEventsAndPoll: vi.fn(async () => []),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findTrash: vi.fn(async () => []),
    findByIds: mocks.fileFindByIds,
    restoreBatch: mocks.fileRestoreBatch,
  })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findTrash: vi.fn(async () => []),
    findById: mocks.folderFindById,
    restore: mocks.folderRestore,
  })),
}));

vi.mock('../../../../../api/utils/blob-utils.js', () => ({
  decrementRefCount: vi.fn(async () => {}),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => {
    await next();
  },
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

describe('manage trash outbox routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fileFindByIds.mockResolvedValue([
      { id: 'file-1', folder_id: 'folder-a' },
      { id: 'file-2', folder_id: 'root' },
    ]);
    mocks.fileRestoreBatch.mockResolvedValue(undefined);
    mocks.folderFindById
      .mockResolvedValueOnce({ id: 'folder-a', parent_id: 'root', name: 'Folder A', is_deleted: 1 })
      .mockResolvedValueOnce({ id: 'folder-b', parent_id: 'folder-a', name: 'Folder B', is_deleted: 1 });
    mocks.folderRestore.mockResolvedValue(undefined);
  });

  it('publishes restore update events for restored files and folders', async () => {
    const app = new Hono();
    app.onError((err, c) =>
      c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
    );
    app.route('/api/manage/trash', trashApp);

    const res = await app.request(
      'http://localhost/api/manage/trash/restore',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: ['file-1', 'file-2'],
          folderIds: ['folder-a', 'folder-b'],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.publishDomainEventsAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'v1_file_updated',
          aggregate_type: 'file',
          aggregate_id: 'file-1',
          payload: expect.objectContaining({
            file_id: 'file-1',
            folder_ids: ['folder-a'],
          }),
        }),
        expect.objectContaining({
          event_type: 'v1_file_updated',
          aggregate_type: 'file',
          aggregate_id: 'file-2',
          payload: expect.objectContaining({
            file_id: 'file-2',
            folder_ids: ['root'],
          }),
        }),
        expect.objectContaining({
          event_type: 'v1_folder_updated',
          aggregate_type: 'folder',
          aggregate_id: 'folder-a',
          payload: expect.objectContaining({
            folder_id: 'folder-a',
            parent_ids: ['root', 'folder-a'],
          }),
        }),
        expect.objectContaining({
          event_type: 'v1_folder_updated',
          aggregate_type: 'folder',
          aggregate_id: 'folder-b',
          payload: expect.objectContaining({
            folder_id: 'folder-b',
            parent_ids: ['folder-a', 'folder-b'],
          }),
        }),
      ]),
      expect.any(String)
    );
  });
});
