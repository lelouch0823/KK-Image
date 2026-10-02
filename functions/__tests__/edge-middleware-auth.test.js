import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  isAdminAuthenticated: vi.fn(),
}));

vi.mock('../api/utils/auth.js', async () => {
  const actual = await vi.importActual('../api/utils/auth.js');
  return {
    ...actual,
    verifyJWT: mocks.verifyJWT,
    isAdminAuthenticated: mocks.isAdminAuthenticated,
  };
});

vi.mock('@sentry/cloudflare', () => ({
  sentryPagesPlugin: vi.fn(() => async (ctx) => ctx.next()),
}));

import { onRequest } from '../_middleware.js';

describe('edge middleware admin auth cookie parsing', () => {
  it('accepts quoted ADMIN_AUTH cookie token on admin pages', async () => {
    const next = vi.fn(async () => new Response('ok', { status: 200 }));
    // 页面守卫现在通过 isAdminAuthenticated（含令牌类型校验）判断
    mocks.isAdminAuthenticated.mockResolvedValue(true);

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
    expect(mocks.isAdminAuthenticated).toHaveBeenCalledWith(context.request, context.env);
  });
});
