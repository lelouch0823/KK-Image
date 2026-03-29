// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  softDelete: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  storeFile: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findById: mocks.findById,
    softDelete: mocks.softDelete,
    findTopLevel: vi.fn(async () => []),
    findAllMinimal: vi.fn(async () => []),
    findByParent: vi.fn(async () => []),
    getBreadcrumbs: vi.fn(async () => []),
    checkNameConflict: vi.fn(async () => false),
    create: vi.fn(),
    isDescendantOrSelf: vi.fn(async () => false),
    update: vi.fn(async () => ({ id: 'folder-1', name: 'Folder One', is_public: 0, share_token: null })),
  })),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findByFolder: vi.fn(async () => []),
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  },
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getManageShareCacheUrls: vi.fn(() => ['http://localhost/api/manage/folders']),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    scheduleCacheInvalidation: mocks.scheduleCacheInvalidation,
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

vi.mock('../../../_shared/utils.js', async () => {
  const actual = await vi.importActual('../../../_shared/utils.js');
  return {
    ...actual,
    MSG: {
      FOLDER: {
        NOT_FOUND: 'NOT_FOUND',
        DELETE_SUCCESS: 'DELETE_SUCCESS',
      },
      COMMON: {
        UPLOAD_NO_FILE: 'UPLOAD_NO_FILE',
      },
      FILE: {
        UPLOAD_SUCCESS: 'UPLOAD_SUCCESS',
        INSTANT_UPLOAD: 'INSTANT_UPLOAD',
      },
    },
    getFileUrl: vi.fn((key) => `/file/${key}`),
    getShareUrl: vi.fn(() => null),
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

describe('manage folders routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({
      id: 'folder-1',
      name: 'Folder One',
      is_system: 0,
      parent_id: 'root',
      share_token: null,
      is_public: 0,
    });
    mocks.softDelete.mockResolvedValue(undefined);
    mocks.storeFile.mockResolvedValue({
      id: 'file-1',
      name: 'asset.png',
      size: 123,
      type: 'image/png',
      storageKey: 'storage-1',
      instantUpload: false,
    });
    mocks.scheduleCacheInvalidation.mockImplementation(() => {});
  });

  it('audits folder deletion with folder name', async () => {
    const app = createApp();
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/folders/folder-1',
      { method: 'DELETE' },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.softDelete).toHaveBeenCalledWith('folder-1');
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'folder_deleted',
        aggregate_type: 'folder',
        aggregate_id: 'folder-1',
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'folder.delete',
        severity: 'critical',
        targetId: 'folder-1',
        target_label: 'Folder One',
        summary: 'Deleted folder Folder One',
      })
    );
  });

  it('audits folder upload with folder name and uploaded file id', async () => {
    const app = createApp();
    const formData = new FormData();
    formData.append('file', new Blob(['img'], { type: 'image/png' }), 'asset.png');
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ id: 'folder-1' })),
        })),
      })),
    };

    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/folders/folder-1/upload',
      { method: 'POST', body: formData },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'file_uploaded',
        aggregate_type: 'file',
        aggregate_id: 'file-1',
        payload: expect.objectContaining({
          file: expect.objectContaining({
            id: 'file-1',
            filename: 'asset.png',
          }),
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'folder.upload',
        targetId: 'folder-1',
        target_label: 'Folder One',
        summary: 'Uploaded file into folder Folder One',
        metadata: { fileId: 'file-1' },
      })
    );
  }, 15000);
});
