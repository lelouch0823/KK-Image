// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  storeFile: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publishSingleDomainEventAndPoll: vi.fn(async () => []),
  ensureOrderFolder: vi.fn(),
}));

vi.mock('../../../../../api/utils/file-utils.js', () => ({
  storeFile: mocks.storeFile,
}));

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureOrderFolder: mocks.ensureOrderFolder,
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

vi.mock('../../../_shared/utils.js', () => ({
  MSG: {
    FILE: {
      UPLOAD_SUCCESS: 'UPLOAD_SUCCESS',
      INSTANT_UPLOAD: 'INSTANT_UPLOAD',
    },
  },
  getFileUrl: vi.fn((key) => `/file/${key}`),
  timestampToIso: vi.fn(() => '2026-03-30T00:00:00.000Z'),
}));

import filesApp from '../files.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/sales/:token/*', async (c, next) => {
    c.set('salesperson', { id: 'sales-1', name: 'Sales One' });
    await next();
  });
  app.route('/api/sales/:token', filesApp);
  return app;
}

describe('sales files routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureOrderFolder.mockResolvedValue('folder-order-1');
    mocks.storeFile.mockResolvedValue({
      id: 'file-sales-1',
      name: 'sales-upload.txt',
      size: 21,
      type: 'text/plain',
      storageKey: 'storage-sales-1',
      instantUpload: false,
    });
  });

  it('publishes file_uploaded through outbox after salesperson upload', async () => {
    const app = createApp();
    const formData = new FormData();
    formData.append('file', new Blob(['sales-upload-body'], { type: 'text/plain' }), 'sales-upload.txt');

    const res = await app.request(
      'http://localhost/api/sales/token-1/upload?orderId=order-1',
      { method: 'POST', body: formData },
      {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: vi.fn(async () => ({ order_no: 'SO-1001' })),
            })),
          })),
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.storeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(File),
      expect.objectContaining({
        createdBy: 'sales-1',
      })
    );
    expect(mocks.publishSingleDomainEventAndPoll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'file_uploaded',
        aggregate_type: 'file',
        aggregate_id: 'file-sales-1',
        payload: expect.objectContaining({
          file: expect.objectContaining({
            id: 'file-sales-1',
            filename: 'sales-upload.txt',
          }),
        }),
      }),
      'file-uploaded:file-sales-1'
    );
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sales.file.upload',
        targetId: 'file-sales-1',
      })
    );
  });
});
