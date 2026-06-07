import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import userApp from '../user.js';

const withUser = (app, user) => {
  app.use('/api/manage/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
};

describe('manage user context response', () => {
  it('does not elevate missing role to admin for non-admin context', async () => {
    const app = new Hono();
    withUser(app, {
      id: 'legacy-1',
      name: 'Legacy User',
      type: 'jwt',
      permissions: ['users:read'],
    });
    app.route('/api/manage/user', userApp);

    const res = await app.request(
      'http://localhost/api/manage/user',
      { method: 'GET' },
      { DB: {} }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.role).toBeNull();
    expect(body.data.type).toBe('jwt');
  });
});
