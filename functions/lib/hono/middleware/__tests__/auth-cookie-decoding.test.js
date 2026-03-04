import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  verifyApiKey: vi.fn(),
}));

vi.mock('../../_shared/utils.js', async () => {
  const actual = await vi.importActual('../../_shared/utils.js');
  return {
    ...actual,
    verifyJWT: mocks.verifyJWT,
    verifyApiKey: mocks.verifyApiKey,
  };
});

import { authMiddleware } from '../auth.js';
import { ADMIN_AUTH_COOKIE } from '../../_shared/utils.js';

function createApp() {
  const app = new Hono();
  app.use('/api/v1/*', authMiddleware);
  app.get('/api/v1/private/ping', (c) => c.json({ success: true, user: c.get('user') }));
  return app;
}

describe('authMiddleware cookie token decoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts quoted admin cookie tokens', async () => {
    const rawToken = 'jwt.token.value';
    mocks.verifyJWT.mockImplementation(async (token) => {
      if (token !== rawToken) {
        throw new Error(`unexpected token: ${token}`);
      }
      return { id: 'u-1', role: 'admin' };
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/v1/private/ping',
      {
        headers: {
          Cookie: `${ADMIN_AUTH_COOKIE}="${rawToken}"`,
        },
      },
      { JWT_SECRET: 'test-secret' }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ success: true, user: expect.objectContaining({ id: 'u-1' }) }));
    expect(mocks.verifyJWT).toHaveBeenCalledWith(rawToken, expect.any(Object));
  });
});
