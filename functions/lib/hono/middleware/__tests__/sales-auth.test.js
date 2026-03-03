import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  authenticateSalesperson: vi.fn(),
}));

vi.mock('../../../../api/utils/salesperson-auth.js', () => ({
  authenticateSalesperson: mocks.authenticateSalesperson,
}));

import { salesAuthMiddleware } from '../sales-auth.js';
import { MSG } from '../../_shared/utils.js';

const createApp = () => {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, scope: 'downstream', error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/sales/:token/*', salesAuthMiddleware);
  app.get('/api/sales/:token/ping', (c) => {
    const salesperson = c.get('salesperson');
    return c.json({ success: true, salespersonId: salesperson?.id || null });
  });
  app.get('/api/sales/:token/crash', () => {
    throw new Error('downstream boom');
  });
  return app;
};

describe('salesAuthMiddleware', () => {
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.authenticateSalesperson.mockResolvedValue({
      id: 'sp-1',
      name: 'Alice',
      access_token: 'token-1',
      is_active: 1,
    });
  });

  afterEach(() => {
    errorSpy?.mockRestore();
  });

  it('accepts valid cookie JWT + path token', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/ping',
      {
        headers: { Cookie: 'sales_token=jwt-cookie' },
      },
      { DB: { prepare: vi.fn() } }
    );

    expect(res.status).toBe(200);
    expect(mocks.authenticateSalesperson).toHaveBeenCalledWith(expect.any(Request), expect.any(Object), 'token-1');
    expect(await res.json()).toEqual(expect.objectContaining({ success: true, salespersonId: 'sp-1' }));
  });

  it('accepts valid bearer JWT + path token', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/ping',
      {
        headers: { Authorization: 'Bearer jwt-bearer' },
      },
      { DB: { prepare: vi.fn() } }
    );

    expect(res.status).toBe(200);
    expect(mocks.authenticateSalesperson).toHaveBeenCalledWith(expect.any(Request), expect.any(Object), 'token-1');
  });

  it('rejects disabled salesperson with 403', async () => {
    mocks.authenticateSalesperson.mockRejectedValue(new Error(MSG.SALESPERSON.DISABLED));

    const app = createApp();
    const res = await app.request('http://localhost/api/sales/token-1/ping', {}, { DB: { prepare: vi.fn() } });
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload).toEqual(expect.objectContaining({ success: false, error: MSG.SALESPERSON.DISABLED }));
  });

  it('rejects mismatched access token with 404', async () => {
    mocks.authenticateSalesperson.mockRejectedValue(new Error(MSG.SALESPERSON.NOT_FOUND));

    const app = createApp();
    const res = await app.request('http://localhost/api/sales/token-1/ping', {}, { DB: { prepare: vi.fn() } });
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload).toEqual(expect.objectContaining({ success: false, error: MSG.SALESPERSON.NOT_FOUND }));
  });

  it('does not swallow downstream route errors after auth passes', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/sales/token-1/crash', {}, { DB: { prepare: vi.fn() } });
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        scope: 'downstream',
        error: 'downstream boom',
      })
    );
  });

  it('returns generic 500 for unexpected auth errors without leaking internals', async () => {
    mocks.authenticateSalesperson.mockRejectedValue(new Error('DB_CONN_TIMEOUT: secret-internal-detail'));

    const app = createApp();
    const res = await app.request('http://localhost/api/sales/token-1/ping', {}, { DB: { prepare: vi.fn() } });
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload).toEqual(expect.objectContaining({ success: false, error: MSG.COMMON.OP_FAILED }));
    expect(payload.error).not.toContain('secret-internal-detail');
  });
});
