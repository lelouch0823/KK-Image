import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import usersRoutes from '../users.js';

const createApp = () => {
  const app = new Hono();
  app.use('/api/v1/users/*', async (c, next) => {
    c.set('user', { id: 'admin-1', type: 'user', role: 'admin', permissions: [] });
    await next();
  });
  app.route('/api/v1/users', usersRoutes);
  app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
  return app;
};

const createNeverTouchDb = () => ({
  prepare: vi.fn(() => {
    throw new Error('DB should not be touched for invalid permissions');
  }),
});

describe('v1 users permissions validation', () => {
  it('rejects unknown permissions on create user', async () => {
    const app = createApp();
    const neverTouchDb = createNeverTouchDb();
    const res = await app.request(
      'http://localhost/api/v1/users',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: 'user_a',
          password: '123456',
          name: 'User A',
          permissions: ['files:read', 'unknown:perm'],
        }),
      },
      { DB: neverTouchDb, JWT_SECRET: 'test-secret' },
      { waitUntil: vi.fn() }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('unknown:perm');
    expect(neverTouchDb.prepare).not.toHaveBeenCalled();
  });

  it('rejects unknown permissions on update user', async () => {
    const app = createApp();
    const neverTouchDb = createNeverTouchDb();
    const res = await app.request(
      'http://localhost/api/v1/users/u-1',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ permissions: ['users:read', 'bad:action'] }),
      },
      { DB: neverTouchDb, JWT_SECRET: 'test-secret' },
      { waitUntil: vi.fn() }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('bad:action');
    expect(neverTouchDb.prepare).not.toHaveBeenCalled();
  });
});
