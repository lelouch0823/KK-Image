import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  getFiles: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  removeFiles: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../repositories/AlbumRepository.js', () => ({
  AlbumRepository: vi.fn(() => ({
    findAll: mocks.findAll,
    findById: mocks.findById,
    getFiles: mocks.getFiles,
    create: mocks.create,
    update: mocks.update,
    removeFiles: mocks.removeFiles,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../../../../../_shared/utils.js', () => ({
  generateId: vi.fn(() => 'album-new'),
  generateShareToken: vi.fn(() => 'share-token-new'),
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
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/albums', albumsApp);
  return app;
}

describe('manage albums routes extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockResolvedValue([
      {
        id: 'album-1',
        name: 'Summer Album',
        description: 'desc',
        is_public: 1,
        share_token: 'token-1',
        file_count: 2,
        cover_key: 'cover-key',
        created_at: 1,
        updated_at: 2,
      },
    ]);
    mocks.findById.mockResolvedValue({
      id: 'album-1',
      name: 'Summer Album',
      description: 'desc',
      is_public: 0,
      share_token: null,
      created_at: 1,
      updated_at: 1,
    });
    mocks.getFiles.mockResolvedValue([
      {
        id: 'file-1',
        name: 'Hero',
        original_name: 'hero.jpg',
        size: 123,
        mime_type: 'image/jpeg',
        storage_key: 'file-key',
        created_at: 10,
      },
    ]);
    mocks.create.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(true);
    mocks.removeFiles.mockResolvedValue(undefined);
  });

  it('maps list and detail payloads to share and file urls', async () => {
    const app = createApp();

    const listResponse = await app.request(
      'http://localhost/api/manage/albums',
      { method: 'GET' },
      { DB: {} }
    );
    const listBody = await listResponse.json();
    expect(listBody.data[0]).toEqual(
      expect.objectContaining({
        shareUrl: 'https://share/token-1',
        coverUrl: 'https://file/cover-key',
        isPublic: true,
      })
    );

    const detailResponse = await app.request(
      'http://localhost/api/manage/albums/album-1',
      { method: 'GET' },
      { DB: {} }
    );
    const detailBody = await detailResponse.json();
    expect(detailBody.data.files[0]).toEqual(
      expect.objectContaining({
        url: 'https://file/file-key',
        originalName: 'hero.jpg',
      })
    );
  });

  it('creates public albums with generated share urls', async () => {
    const app = createApp();

    const response = await app.request(
      'http://localhost/api/manage/albums',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ' New Album ',
          description: '  desc  ',
          isPublic: true,
          coverFileId: 'cover-1',
        }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toEqual({
      id: 'album-new',
      shareUrl: 'https://share/share-token-new',
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'album-new',
        name: 'New Album',
        description: 'desc',
        isPublic: true,
        shareToken: 'share-token-new',
        coverFileId: 'cover-1',
      })
    );
  });

  it('adds a share token when a private album is made public', async () => {
    const app = createApp();

    const response = await app.request(
      'http://localhost/api/manage/albums/album-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: true }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith('album-1', {
      is_public: 1,
      share_token: 'share-token-new',
    });
  });

  it('removes files with audit metadata and rejects empty payloads', async () => {
    const app = createApp();

    const badResponse = await app.request(
      'http://localhost/api/manage/albums/album-1/files',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: [] }),
      },
      { DB: {} }
    );
    expect(badResponse.status).toBe(400);

    const response = await app.request(
      'http://localhost/api/manage/albums/album-1/files',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ['file-1', 'file-2'] }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(200);
    expect(mocks.removeFiles).toHaveBeenCalledWith('album-1', ['file-1', 'file-2']);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'album.file.remove',
        target_label: 'album-1',
        summary: 'Removed 2 files from album album-1',
      })
    );
  });
});
