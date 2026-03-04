import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
}));

vi.mock('../api/utils/auth.js', async () => {
  const actual = await vi.importActual('../api/utils/auth.js');
  return {
    ...actual,
    verifyJWT: mocks.verifyJWT,
  };
});

vi.mock('@sentry/cloudflare', () => ({
  sentryPagesPlugin: vi.fn(() => async (ctx) => ctx.next()),
}));

import { onRequest } from '../_middleware.js';

describe('edge middleware admin auth cookie parsing', () => {
  it('accepts quoted ADMIN_AUTH cookie token on admin pages', async () => {
    const next = vi.fn(async () => new Response('ok', { status: 200 }));
    mocks.verifyJWT.mockResolvedValue({ id: 'admin-1' });

    const context = {
      request: new Request('https://example.com/admin', {
        headers: {
          Cookie: 'ADMIN_AUTH="jwt.edge.token"',
        },
      }),
      env: { JWT_SECRET: 'test-secret' },
      next,
    };

    const res = await onRequest[1](context);

    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.verifyJWT).toHaveBeenCalledWith('jwt.edge.token', context.env);
  });
});
