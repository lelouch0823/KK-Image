import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import authRoutes from '../auth.js';

const createApp = (user = null) => {
  const app = new Hono();
  if (user) {
    app.use('/api/v1/auth/*', async (c, next) => {
      c.set('user', user);
      await next();
    });
  }
  app.route('/api/v1/auth', authRoutes);
  return app;
};

describe('v1 auth /me context', () => {
  it('does not elevate missing role to admin for non-admin token context', async () => {
    const app = createApp({
      id: 'legacy-1',
      name: 'Legacy User',
      type: 'jwt',
      permissions: [],
    });

    const res = await app.request('http://localhost/api/v1/auth/me');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.role).toBeNull();
    expect(body.data.type).toBe('jwt');
  });

  it('keeps admin fallback only for admin type payloads', async () => {
    const app = createApp({
      id: 'root',
      name: 'Root',
      type: 'admin',
      permissions: ['admin:full'],
    });

    const res = await app.request('http://localhost/api/v1/auth/me');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('admin');
    expect(body.data.type).toBe('admin');
  });
});
