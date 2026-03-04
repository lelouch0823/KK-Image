import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import permissionsRoutes from '../permissions.js';
import { getPolicyMetadata } from '../../../../authz/index.js';

const createApp = (user = null) => {
  const app = new Hono();
  if (user) {
    app.use('/api/v1/permissions/*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }
  app.route('/api/v1/permissions', permissionsRoutes);
  return app;
};

describe('v1 permissions contract', () => {
  it('returns permissions keys from policy metadata actions', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/permissions');
    const body = await res.json();
    const metadata = getPolicyMetadata();

    expect(res.status).toBe(200);
    expect(Object.keys(body.data.permissions).sort()).toEqual([...metadata.actions].sort());
  });

  it('returns role definitions from policy metadata', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/permissions');
    const body = await res.json();
    const metadata = getPolicyMetadata();

    expect(res.status).toBe(200);
    expect(Object.keys(body.data.roles).sort()).toEqual(Object.keys(metadata.roles).sort());
  });

  it('evaluates /user permissions through OPA decisions', async () => {
    const app = createApp({ id: 'u1', name: 'M', type: 'user', role: 'manager', permissions: [] });
    const res = await app.request('http://localhost/api/v1/permissions/user');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.permissions).toContain('files:read');
    expect(body.data.permissions).not.toContain('admin:full');
    expect(body.data.isAdmin).toBe(false);
  });

  it('evaluates /check permissions through OPA decisions', async () => {
    const app = createApp({ id: 'u2', name: 'V', type: 'user', role: 'viewer', permissions: [] });
    const res = await app.request('http://localhost/api/v1/permissions/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: ['files:read', 'files:delete'] }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.permissions['files:read']).toBe(true);
    expect(body.data.permissions['files:delete']).toBe(false);
  });

  it('rejects unknown permissions in /check payload', async () => {
    const app = createApp({ id: 'u3', name: 'V2', type: 'user', role: 'viewer', permissions: [] });
    const res = await app.request('http://localhost/api/v1/permissions/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: ['files:read', 'unknown:perm'] }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });
});

