import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const authzMocks = vi.hoisted(() => ({
  evaluateUserPermission: vi.fn(),
  recordAuditEvent: vi.fn(async () => {}),
}));

vi.mock('../../../authz/index.js', async () => {
  const actual = await vi.importActual('../../../authz/index.js');
  return {
    ...actual,
    evaluateUserPermission: authzMocks.evaluateUserPermission,
  };
});

vi.mock('../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../_shared/audit-helpers.js');
  return {
    ...actual,
    recordAuditEvent: authzMocks.recordAuditEvent,
  };
});

import { requirePermission } from '../auth.js';

function createApp(user) {
  const app = new Hono();
  app.use('/secure/*', async (c, next) => {
    if (user) c.set('user', user);
    await next();
  });
  app.get('/secure/ping', requirePermission('files:read'), (c) => c.json({ success: true }));
  app.post('/secure/ping', requirePermission('files:read'), (c) => c.json({ success: true }));
  return app;
}

describe('requirePermission with authz engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is missing', async () => {
    const app = createApp(null);
    const res = await app.request('http://localhost/secure/ping');
    expect(res.status).toBe(401);
  });

  it('returns 403 when authz engine denies', async () => {
    authzMocks.evaluateUserPermission.mockResolvedValueOnce(false);
    const app = createApp({ id: 'u1', role: 'viewer', permissions: [] });

    const res = await app.request('http://localhost/secure/ping', { method: 'POST' }, { AUTHZ_ENGINE: 'opa', DB: {} });
    expect(res.status).toBe(403);
    expect(authzMocks.recordAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        result: 'denied',
        summary: expect.stringContaining('denied'),
      })
    );
  });

  it('allows request when authz engine allows', async () => {
    authzMocks.evaluateUserPermission.mockResolvedValueOnce(true);
    const app = createApp({ id: 'u1', role: 'manager', permissions: [] });

    const res = await app.request('http://localhost/secure/ping', {}, { AUTHZ_ENGINE: 'opa' });
    expect(res.status).toBe(200);
    expect(authzMocks.evaluateUserPermission).toHaveBeenCalledTimes(1);
  });

  it('does not bypass authz for admin:full token', async () => {
    authzMocks.evaluateUserPermission.mockResolvedValueOnce(false);
    const app = createApp({ id: 'u1', type: 'admin', role: 'admin', permissions: ['admin:full'] });

    const res = await app.request('http://localhost/secure/ping', {}, { AUTHZ_ENGINE: 'opa' });
    expect(res.status).toBe(403);
    expect(authzMocks.evaluateUserPermission).toHaveBeenCalledTimes(1);
  });
});

