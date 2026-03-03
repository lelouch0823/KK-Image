// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  ensureProductFolder: vi.fn(),
  storeFile: vi.fn(),
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

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureProductFolder: mocks.ensureProductFolder,
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
    mocks.storeFile.mockResolvedValue({
      id: 'file-1',
      storageKey: 'storage-1',
      storage_key: 'storage-1',
      instantUpload: false,
    });
  });

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
});
