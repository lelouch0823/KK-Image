// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  ensureProductFolder: vi.fn(),
  ensureSpaceFolder: vi.fn(),
  storeFile: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishDomainEventsAndPoll: vi.fn(async () => []),
  currentPermissions: ['files:write', 'spaces:manage'],
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: (permission) => async (c, next) => {
    c.set('user', { id: 'admin-1', permissions: mocks.currentPermissions });
    if (!mocks.currentPermissions.includes(permission)) {
      return c.json({ success: false, error: 'FORBIDDEN' }, 403);
    }
    await next();
  },
}));

vi.mock('../../../../../_shared/utils.js', () => ({
  MSG: {
    COMMON: { UPLOAD_NO_FILE: 'NO_FILE' },
    FILE: { UPLOAD_SUCCESS: 'UPLOAD_SUCCESS', INSTANT_UPLOAD: 'INSTANT_UPLOAD' },
    SPACE: { NOT_FOUND: 'SPACE_NOT_FOUND' },
  },
  storeFile: mocks.storeFile,
  getFileUrl: vi.fn((key) => `/file/${key}`),
  timestampToIso: vi.fn(() => '2026-03-30T00:00:00.000Z'),
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

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureProductFolder: mocks.ensureProductFolder,
  ensureSpaceFolder: mocks.ensureSpaceFolder,
}));

import uploadApp from '../upload.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err.message }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/upload', uploadApp);
  return app;
}

describe('manage upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentPermissions = ['files:write', 'spaces:manage'];
    mocks.ensureProductFolder.mockResolvedValue('folder-products');
    mocks.ensureSpaceFolder.mockResolvedValue('folder-space-1');
    mocks.storeFile.mockResolvedValue({
      id: 'file-1',
      storageKey: 'storage-1',
      storage_key: 'storage-1',
      instantUpload: false,
    });
  });

  function createDb() {
    const insertRun = vi.fn(async () => ({ success: true }));
    const updateRun = vi.fn(async () => ({ success: true }));
    return {
      insertRun,
      updateRun,
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          first: vi.fn(async () => {
            if (sql.includes('FROM spaces WHERE id = ?')) {
              return { name: 'Space A', parent_id: 'parent-1', product_id: 'prod-1' };
            }
            if (sql.includes('SELECT MAX(sort_order) as max_order FROM space_files')) {
              expect(args[0]).toBe('space-1');
              return { max_order: 3 };
            }
            return null;
          }),
          run: sql.includes('INSERT INTO space_files') ? insertRun : updateRun,
        })),
      })),
    };
  }

  it('routes variant context uploads into product folder instead of root', async () => {
    const app = createApp();
    const formData = new FormData();
    formData.append('file', new Blob(['mock-image'], { type: 'image/png' }), 'variant.png');

    const res = await app.request(
      'http://localhost/api/manage/upload?context=variant',
      { method: 'POST', body: formData },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.ensureProductFolder).toHaveBeenCalledTimes(1);
    expect(mocks.storeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(File),
      expect.objectContaining({ folderId: 'folder-products' })
    );
    expect(mocks.publishDomainEventsAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      [
        expect.objectContaining({
          event_type: 'file_uploaded',
          aggregate_type: 'file',
          aggregate_id: 'file-1',
          payload: expect.objectContaining({
            file: expect.objectContaining({
              id: 'file-1',
              filename: 'variant.png',
            }),
          }),
        }),
      ],
      'manage-upload:file-1'
    );
  }, 15000);

  it('associates uploaded file with the target space and audits it', async () => {
    const app = createApp();
    const db = createDb();
    const formData = new FormData();
    formData.append('file', new Blob(['mock-image'], { type: 'image/png' }), 'space.png');

    const res = await app.request(
      'http://localhost/api/manage/upload?spaceId=space-1',
      { method: 'POST', body: formData },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.ensureSpaceFolder).toHaveBeenCalledWith(expect.anything(), 'Space A');
    expect(db.insertRun).toHaveBeenCalledTimes(1);
    expect(db.updateRun).toHaveBeenCalledTimes(1);
    expect(mocks.storeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(File),
      expect.objectContaining({ folderId: 'folder-space-1' })
    );
    expect(mocks.publishDomainEventsAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'file_uploaded',
          aggregate_type: 'file',
          aggregate_id: 'file-1',
        }),
        expect.objectContaining({
          event_type: 'space_file_added',
          aggregate_type: 'space',
          aggregate_id: 'space-1',
          payload: {
            space_id: 'space-1',
            parent_id: 'parent-1',
            product_ids: ['prod-1'],
            file_ids: ['file-1'],
          },
        }),
      ]),
      'manage-upload:file-1'
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'upload.create',
        targetId: 'file-1',
        target_label: 'space.png',
        metadata: expect.objectContaining({ spaceId: 'space-1' }),
      })
    );
  }, 15000);

  it('requires spaces:manage before associating uploads with a space', async () => {
    mocks.currentPermissions = ['files:write'];
    const app = createApp();
    const db = createDb();
    const formData = new FormData();
    formData.append('file', new Blob(['mock-image'], { type: 'image/png' }), 'space.png');

    const res = await app.request(
      'http://localhost/api/manage/upload?spaceId=space-1',
      { method: 'POST', body: formData },
      { DB: db },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(403);
    expect(mocks.storeFile).not.toHaveBeenCalled();
    expect(db.insertRun).not.toHaveBeenCalled();
  }, 15000);

  it('rejects uploads for unknown spaces before persisting files', async () => {
    const app = createApp();
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => null),
          run: vi.fn(async () => ({ success: true })),
        })),
      })),
    };
    const formData = new FormData();
    formData.append('file', new Blob(['mock-image'], { type: 'image/png' }), 'missing-space.png');

    const res = await app.request(
      'http://localhost/api/manage/upload?spaceId=space-missing',
      { method: 'POST', body: formData },
      { DB: db },
      { waitUntil: vi.fn() }
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('SPACE_NOT_FOUND');
    expect(mocks.storeFile).not.toHaveBeenCalled();
    expect(mocks.publishDomainEventsAndPoll).not.toHaveBeenCalled();
  }, 15000);

  it('returns 400 when caller-provided contentHash is invalid', async () => {
    mocks.storeFile.mockRejectedValueOnce(new Error('Invalid contentHash'));
    const app = createApp();
    const formData = new FormData();
    formData.append('file', new Blob(['mock-image'], { type: 'image/png' }), 'bad-hash.png');

    const res = await app.request(
      'http://localhost/api/manage/upload?contentHash=not-a-sha256',
      { method: 'POST', body: formData },
      { DB: {} },
      { waitUntil: vi.fn() }
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid contentHash');
  }, 15000);
});
