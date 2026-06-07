import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(async () => {}),
}));

vi.mock('../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../_shared/audit-helpers.js');
  return {
    ...actual,
    recordAuditEvent: mocks.recordAuditEvent,
  };
});

import { authMiddleware } from '../auth.js';
import { MSG } from '../../../../_shared/utils.js';

function createApp() {
  const app = new Hono();
  app.use('/api/v1/*', authMiddleware);

  app.get('/api/v1/auth/check', (c) => c.json({ success: true, route: 'check' }));
  app.get('/api/v1/auth/checkpoint', (c) => c.json({ success: true, route: 'checkpoint' }));
  app.get('/api/v1/health/info', (c) => c.json({ success: true, route: 'health-info' }));
  app.get('/api/v1/healthcheck', (c) => c.json({ success: true, route: 'healthcheck' }));
  app.get('/api/v1/audit-logs/export', (c) => c.json({ success: true, route: 'audit-export' }));

  return app;
}

describe('authMiddleware public route boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows exact public auth check endpoint', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/auth/check');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ success: true, route: 'check' }));
  });

  it('does not allow auth/check prefix collision endpoint', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/auth/checkpoint');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(
      expect.objectContaining({ success: false, error: MSG.AUTH.REQUIRED })
    );
  });

  it('allows health sub-route by explicit boundary', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/health/info');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({ success: true, route: 'health-info' })
    );
  });

  it('does not allow health prefix collision endpoint', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/healthcheck');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(
      expect.objectContaining({ success: false, error: MSG.AUTH.REQUIRED })
    );
  });

  it('records unauthorized audit event for export GET without credentials', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/audit-logs/export', {}, { DB: {} });

    expect(res.status).toBe(401);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        result: 'denied',
        action: 'audit-logs.get.unauthorized',
      })
    );
  });
});
