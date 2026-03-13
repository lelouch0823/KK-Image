import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  repoFindAll: vi.fn(),
  repoFindById: vi.fn(),
  repoGetFiles: vi.fn(),
  repoCreate: vi.fn(),
  repoUpdate: vi.fn(),
  repoDelete: vi.fn(),
  repoAddFiles: vi.fn(),
  repoRemoveFiles: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../repositories/AlbumRepository.js', () => ({
  AlbumRepository: vi.fn(() => ({
    findAll: mocks.repoFindAll,
    findById: mocks.repoFindById,
    getFiles: mocks.repoGetFiles,
    create: mocks.repoCreate,
    update: mocks.repoUpdate,
    delete: mocks.repoDelete,
    addFiles: mocks.repoAddFiles,
    removeFiles: mocks.repoRemoveFiles,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../_shared/utils.js', () => ({
  generateId: vi.fn(() => 'album-new'),
  generateShareToken: vi.fn(() => 'share-token'),
  getShareUrl: vi.fn((token) => (token ? `https://share/${token}` : null)),
  getFileUrl: vi.fn((key) => (key ? `https://file/${key}` : null)),
  MSG: {
    ALBUM: {
      NOT_FOUND: 'ALBUM_NOT_FOUND',
      DELETE_SUCCESS: 'ALBUM_DELETE_SUCCESS',
      ADD_FILES_SUCCESS: 'ALBUM_ADD_FILES_SUCCESS {count}',
      REMOVE_FILES_SUCCESS: 'ALBUM_REMOVE_FILES_SUCCESS {count}',
    },
    COMMON: {
      INVALID_PARAMS: 'INVALID_PARAMS',
    },
  },
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
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
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import albumsApp from '../albums.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/albums', albumsApp);
  return app;
}

describe('manage albums routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repoFindAll.mockResolvedValue([]);
    mocks.repoFindById.mockResolvedValue({
      id: 'album-1',
      name: 'Summer Album',
      description: 'desc',
      is_public: 0,
      share_token: null,
      created_at: 1,
      updated_at: 1,
    });
    mocks.repoGetFiles.mockResolvedValue([]);
    mocks.repoCreate.mockResolvedValue(undefined);
    mocks.repoUpdate.mockResolvedValue({ id: 'album-1', name: 'Summer Album', share_token: null, is_public: 0 });
    mocks.repoDelete.mockResolvedValue(undefined);
    mocks.repoAddFiles.mockResolvedValue(undefined);
    mocks.repoRemoveFiles.mockResolvedValue(undefined);
  });

  it('records destructive delete audit with album label', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/albums/album-1',
      { method: 'DELETE' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.repoDelete).toHaveBeenCalledWith('album-1');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'album.delete',
        severity: 'critical',
        targetId: 'album-1',
        target_label: 'Summer Album',
        summary: 'Deleted album Summer Album',
      })
    );
  });

  it('records add-files audit with album name and file count', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/albums/album-1/files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ['file-1', 'file-2'] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.repoAddFiles).toHaveBeenCalledWith('album-1', ['file-1', 'file-2']);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'album.file.add',
        targetId: 'album-1',
        target_label: 'Summer Album',
        summary: 'Added 2 files to album Summer Album',
        metadata: { count: 2 },
      })
    );
  });
});
