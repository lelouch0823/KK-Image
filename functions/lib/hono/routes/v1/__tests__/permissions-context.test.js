import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const authzMocks = vi.hoisted(() => ({
  evaluateActionPermission: vi.fn(async () => true),
}));

vi.mock('../../../../authz/index.js', async () => {
  const actual = await vi.importActual('../../../../authz/index.js');
  return {
    ...actual,
    evaluateActionPermission: authzMocks.evaluateActionPermission,
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
  it('evaluates permissions through shared route-agnostic action helper', async () => {
    authzMocks.evaluateActionPermission.mockClear();

    const app = createApp({
      id: 'u1',
      name: 'ManagerUser',
      type: 'user',
      role: 'manager',
      permissions: [],
    });
    const res = await app.request('http://localhost/api/v1/permissions/user');

    expect(res.status).toBe(200);
    expect(authzMocks.evaluateActionPermission).toHaveBeenCalled();
    const [firstCall] = authzMocks.evaluateActionPermission.mock.calls[0];
    expect(firstCall).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'u1' }),
        permission: expect.any(String),
      })
    );
    expect(firstCall.path).toBeUndefined();
    expect(firstCall.method).toBeUndefined();
  });
});
