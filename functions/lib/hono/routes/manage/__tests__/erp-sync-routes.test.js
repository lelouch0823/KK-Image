import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  createConnection: vi.fn(),
  updateConnection: vi.fn(),
  handleWebhook: vi.fn(),
}));

vi.mock('../../../../../repositories/ErpSyncRepository.js', () => ({
  ErpSyncRepository: vi.fn(() => ({
    createConnection: mocks.createConnection,
    updateConnection: mocks.updateConnection,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (c, next) => {
    if (!c.get('user')) return c.json({ success: false, error: 'auth required' }, 401);
    return next();
  },
}));

vi.mock('../../../../../services/ErpSyncService.js', () => ({
  ErpSyncService: vi.fn(() => ({
    handleWebhook: mocks.handleWebhook,
  })),
}));

import erpSyncApp from '../erp-sync.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/erp-sync/*', async (c, next) => {
    c.set('user', { id: 'admin-1' });
    await next();
  });
  app.route('/api/manage/erp-sync', erpSyncApp);
  return app;
}

function createPublicApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/erp-sync', erpSyncApp);
  return app;
}

describe('manage ERP sync routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createConnection.mockResolvedValue({ id: 'erp-1' });
    mocks.updateConnection.mockResolvedValue({ id: 'erp-1' });
    mocks.handleWebhook.mockResolvedValue({ success: true });
  });

  it('rejects private ERP base URLs when creating connections', async () => {
    const response = await createApp().request(
      'http://localhost/api/manage/erp-sync/connections',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Unsafe ERP',
          adapterType: 'generic',
          baseUrl: 'http://169.254.169.254',
          authType: 'api_key',
        }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(400);
    expect(mocks.createConnection).not.toHaveBeenCalled();
  });

  it('rejects private ERP base URLs when updating connections', async () => {
    const response = await createApp().request(
      'http://localhost/api/manage/erp-sync/connections/erp-1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'http://10.0.0.1',
        }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(400);
    expect(mocks.updateConnection).not.toHaveBeenCalled();
  });

  it('allows signed ERP webhooks to reach the HMAC handler without admin context', async () => {
    const response = await createPublicApp().request(
      'http://localhost/api/manage/erp-sync/connections/erp-1/webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'abc123',
        },
        body: JSON.stringify({ entity_type: 'product', entity_id: 'erp-prod-1' }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(200);
    expect(mocks.handleWebhook).toHaveBeenCalledWith(
      'erp-1',
      JSON.stringify({ entity_type: 'product', entity_id: 'erp-prod-1' }),
      'abc123'
    );
  });

  it('returns service status for invalid ERP webhook signatures', async () => {
    const error = new Error('webhook 签名验证失败');
    error.statusCode = 401;
    mocks.handleWebhook.mockRejectedValueOnce(error);

    const response = await createPublicApp().request(
      'http://localhost/api/manage/erp-sync/connections/erp-1/webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'bad-signature',
        },
        body: JSON.stringify({ entity_type: 'product', entity_id: 'erp-prod-1' }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(
      expect.objectContaining({ success: false, error: 'webhook 签名验证失败' })
    );
  });
});
