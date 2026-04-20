// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findTopLevel: vi.fn(),
  findAllMinimal: vi.fn(),
  findByParent: vi.fn(),
  getBreadcrumbs: vi.fn(),
  checkNameConflict: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  isDescendantOrSelf: vi.fn(),
  findByFolder: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  storeFile: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findById: mocks.findById,
    findTopLevel: mocks.findTopLevel,
    findAllMinimal: mocks.findAllMinimal,
    findByParent: mocks.findByParent,
    getBreadcrumbs: mocks.getBreadcrumbs,
    checkNameConflict: mocks.checkNameConflict,
    create: mocks.create,
    update: mocks.update,
    softDelete: mocks.softDelete,
    isDescendantOrSelf: mocks.isDescendantOrSelf,
  })),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findByFolder: mocks.findByFolder,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  },
}));

vi.mock('../../../../../_shared/utils.js', () => ({
  generateId: vi.fn(() => 'folder-new'),
  generateShareToken: vi.fn(() => 'share-token-new'),
  timestampToIso: vi.fn((value) => new Date(value).toISOString()),
  getShareUrl: vi.fn((token) => (token ? `https://share/${token}` : null)),
  getFileUrl: vi.fn((key) => (key ? `https://file/${key}` : null)),
  MSG: {
    FOLDER: {
      NOT_FOUND: 'NOT_FOUND',
      DELETE_SUCCESS: 'DELETE_SUCCESS',
      PARENT_NOT_FOUND: 'PARENT_NOT_FOUND',
      NAME_CONFLICT: 'NAME_CONFLICT',
      ROOT_CANNOT_DELETE: 'ROOT_CANNOT_DELETE',
      SYSTEM_FOLDER_DELETE: 'SYSTEM_FOLDER_DELETE',
      MOVE_TO_SELF: 'MOVE_TO_SELF',
    },
    COMMON: {
      UPLOAD_NO_FILE: 'UPLOAD_NO_FILE',
    },
    FILE: {
      UPLOAD_SUCCESS: 'UPLOAD_SUCCESS',
      INSTANT_UPLOAD: 'INSTANT_UPLOAD',
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

vi.mock('../../../../../api/utils/file-utils.js', () => ({
  storeFile: mocks.storeFile,
}));

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import foldersApp from '../folders.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/folders', foldersApp);
  return app;
}

describe('manage folders routes extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({
      id: 'folder-1',
      name: 'Folder One',
      description: 'desc',
      parent_id: 'root',
      share_token: null,
      is_public: 0,
      password: null,
      created_at: 1,
      updated_at: 1,
      is_system: 0,
    });
    mocks.findTopLevel.mockResolvedValue([{ id: 'top-1', name: 'Top', is_public: 0 }]);
    mocks.findAllMinimal.mockResolvedValue([{ id: 'all-1', name: 'All', is_public: 1 }]);
    mocks.findByParent.mockResolvedValue([{ id: 'child-1', name: 'Child', is_public: 0 }]);
    mocks.getBreadcrumbs.mockResolvedValue([{ id: 'root', name: 'Root' }]);
    mocks.checkNameConflict.mockResolvedValue(false);
    mocks.create.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(undefined);
    mocks.softDelete.mockResolvedValue(undefined);
    mocks.isDescendantOrSelf.mockResolvedValue(false);
    mocks.findByFolder.mockResolvedValue([{ id: 'file-1', name: 'Asset', original_name: 'asset.png', size: 1, mime_type: 'image/png', storage_key: 'key-1', created_at: 10 }]);
    mocks.storeFile.mockResolvedValue({
      id: 'file-1',
      name: 'asset.png',
      size: 123,
      type: 'image/png',
      storageKey: 'storage-1',
      instantUpload: false,
    });
  });

  it('switches list source based on query params and maps detail payloads', async () => {
    const app = createApp();

    const topResponse = await app.request('http://localhost/api/manage/folders', { method: 'GET' }, { DB: {} });
    expect(topResponse.status).toBe(200);
    expect(mocks.findTopLevel).toHaveBeenCalled();

    const allResponse = await app.request('http://localhost/api/manage/folders?all=true', { method: 'GET' }, { DB: {} });
    expect(allResponse.status).toBe(200);
    expect(mocks.findAllMinimal).toHaveBeenCalled();

    const parentResponse = await app.request('http://localhost/api/manage/folders?parent_id=folder-1', { method: 'GET' }, { DB: {} });
    expect(parentResponse.status).toBe(200);
    expect(mocks.findByParent).toHaveBeenCalledWith('folder-1');

    const detailResponse = await app.request('http://localhost/api/manage/folders/folder-1', { method: 'GET' }, { DB: {} });
    const detailBody = await detailResponse.json();
    expect(detailBody.data).toEqual(
      expect.objectContaining({
        shareUrl: null,
        breadcrumbs: [{ id: 'root', name: 'Root' }],
        files: [
          expect.objectContaining({
            url: 'https://file/key-1',
            originalName: 'asset.png',
          }),
        ],
      })
    );
  });

  it('creates folders, adds share tokens when public, and records audits', async () => {
    const app = createApp();

    const response = await app.request(
      'http://localhost/api/manage/folders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ' New Folder ',
          description: '  desc  ',
          parentId: 'parent-1',
          isPublic: true,
          password: '1234',
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'folder-new',
        parentId: 'parent-1',
        name: 'New Folder',
        description: 'desc',
        shareToken: 'share-token-new',
        isPublic: true,
        password: '1234',
      })
    );
  });

  it('updates folders, regenerates share tokens, and rejects self moves', async () => {
    const app = createApp();
    mocks.isDescendantOrSelf.mockResolvedValueOnce(true);

    const conflictResponse = await app.request(
      'http://localhost/api/manage/folders/folder-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: 'folder-1' }),
      },
      { DB: {} }
    );
    expect(conflictResponse.status).toBe(400);

    const response = await app.request(
      'http://localhost/api/manage/folders/folder-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: true, shareExpiresAt: Date.now() + 1000 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(response.status).toBe(200);
    const [folderId, updates, values] = mocks.update.mock.calls[0];
    expect(folderId).toBe('folder-1');
    expect(updates).toEqual(
      expect.arrayContaining([
        'is_public = ?',
        'share_token = ?',
        'share_expires_at = ?',
        'updated_at = ?',
      ])
    );
    expect(values).toEqual(
      expect.arrayContaining([1, 'share-token-new', expect.any(Number), expect.any(Number)])
    );
  });

  it('rejects root deletion and uploads missing files with 400', async () => {
    const app = createApp();

    const rootDelete = await app.request('http://localhost/api/manage/folders/root', { method: 'DELETE' }, { DB: {} });
    expect(rootDelete.status).toBe(400);

    const uploadResponse = await app.request(
      'http://localhost/api/manage/folders/folder-1/upload',
      { method: 'POST', body: new FormData() },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    expect(uploadResponse.status).toBe(400);
  });

  it('uploads files and emits publish/audit events', async () => {
    const app = createApp();
    const formData = new FormData();
    formData.append('file', new Blob(['img'], { type: 'image/png' }), 'asset.png');

    const response = await app.request(
      'http://localhost/api/manage/folders/folder-1/upload?contentHash=abc&originalHash=def',
      { method: 'POST', body: formData },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(response.status).toBe(200);
    expect(mocks.storeFile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        contentHash: 'abc',
        originalHash: 'def',
        folderId: 'folder-1',
        createdBy: 'admin-1',
      })
    );
    expect(mocks.publish).toHaveBeenCalled();
  });
});
