import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const authzMocks = vi.hoisted(() => ({
  evaluateUserPermission: vi.fn(async () => true),
}));

vi.mock('../../../../authz/index.js', async () => {
  const actual = await vi.importActual('../../../../authz/index.js');
  return {
    ...actual,
    evaluateUserPermission: authzMocks.evaluateUserPermission,
  };
});

import permissionsRoutes from '../permissions.js';

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

describe('v1 permissions context', () => {
  it('evaluates permissions with route-agnostic context', async () => {
    authzMocks.evaluateUserPermission.mockClear();

    const app = createApp({ id: 'u1', name: 'M', type: 'user', role: 'manager', permissions: [] });
    const res = await app.request('http://localhost/api/v1/permissions/user');

    expect(res.status).toBe(200);
    expect(authzMocks.evaluateUserPermission).toHaveBeenCalled();
    expect(authzMocks.evaluateUserPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        path: null,
        method: null,
      })
    );
  });
});
