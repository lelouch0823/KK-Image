// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  ensureProductFolder: vi.fn(),
  ensureSpaceFolder: vi.fn(),
  storeFile: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (c, next) => {
    c.set('user', { id: 'admin-1' });
    await next();
  },
}));

vi.mock('../../../_shared/utils.js', () => ({
  MSG: {
    COMMON: { UPLOAD_NO_FILE: 'NO_FILE' },
    FILE: { UPLOAD_SUCCESS: 'UPLOAD_SUCCESS', INSTANT_UPLOAD: 'INSTANT_UPLOAD' },
  },
  storeFile: mocks.storeFile,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureProductFolder: mocks.ensureProductFolder,
  ensureSpaceFolder: mocks.ensureSpaceFolder,
}));

import uploadApp from '../upload.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) => c.json({ success: false, error: err.message }, Number(err?.statusCode || 500)));
  app.route('/api/manage/upload', uploadApp);
  return app;
}

describe('manage upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
            if (sql.includes('SELECT name FROM spaces')) {
              return { name: 'Space A' };
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
});
