import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const authzMocks = vi.hoisted(() => ({
  evaluatePermission: vi.fn(),
}));

vi.mock('../../../authz/index.js', async () => {
  const actual = await vi.importActual('../../../authz/index.js');
  return {
    ...actual,
    evaluatePermission: authzMocks.evaluatePermission,
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
    authzMocks.evaluatePermission.mockResolvedValueOnce(false);
    const app = createApp({ id: 'u1', role: 'viewer', permissions: [] });

    const res = await app.request('http://localhost/secure/ping', {}, { AUTHZ_ENGINE: 'opa' });
    expect(res.status).toBe(403);
  });

  it('allows request when authz engine allows', async () => {
    authzMocks.evaluatePermission.mockResolvedValueOnce(true);
    const app = createApp({ id: 'u1', role: 'manager', permissions: [] });

    const res = await app.request('http://localhost/secure/ping', {}, { AUTHZ_ENGINE: 'opa' });
    expect(res.status).toBe(200);
    expect(authzMocks.evaluatePermission).toHaveBeenCalledTimes(1);
  });

  it('does not bypass authz for admin:full token', async () => {
    authzMocks.evaluatePermission.mockResolvedValueOnce(false);
    const app = createApp({ id: 'u1', type: 'admin', role: 'admin', permissions: ['admin:full'] });

    const res = await app.request('http://localhost/secure/ping', {}, { AUTHZ_ENGINE: 'opa' });
    expect(res.status).toBe(403);
    expect(authzMocks.evaluatePermission).toHaveBeenCalledTimes(1);
  });
});

