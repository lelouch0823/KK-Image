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

function createApp() {
  const app = new Hono();
  app.use('/api/v1/*', authMiddleware);
  app.get('/api/v1/private/ping', (c) => c.json({ success: true, user: c.get('user') }));
  return app;
}

describe('authMiddleware legacy context handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects jwt context that has neither role nor permissions', async () => {
    mocks.verifyJWT.mockResolvedValue({
      id: 'legacy-1',
      type: 'jwt',
      role: null,
      permissions: [],
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/v1/private/ping',
      {
        headers: {
          Authorization: 'Bearer legacy.token.value',
        },
      },
      { JWT_SECRET: 'test-secret' }
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
  });
});
