import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
}));

vi.mock('../../utils/auth.js', async () => {
  const actual = await vi.importActual('../../utils/auth.js');
  return {
    ...actual,
    verifyJWT: authMocks.verifyJWT,
  };
});

import { onRequestGet } from '../verify.js';

function createEnv() {
  return {
    TURNSTILE_SITE_KEY: 'site-key',
    TURNSTILE_SECRET_KEY: 'secret-key',
    JWT_SECRET: 'jwt-secret',
  };
}

describe('turnstile verify config route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats quoted auth cookie token as admin session', async () => {
    const env = createEnv();
    authMocks.verifyJWT.mockImplementation(async (token) => {
      if (token !== 'jwt.admin.quoted') {
        throw new Error(`unexpected token: ${token}`);
      }
      return { id: 'u-admin', type: 'admin', role: 'admin' };
    });

    const request = new Request('https://example.com/api/turnstile/verify', {
      headers: {
        Cookie: 'ADMIN_AUTH="jwt.admin.quoted"',
      },
    });

    const response = await onRequestGet({ env, request });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authMocks.verifyJWT).toHaveBeenCalledWith('jwt.admin.quoted', env);
    expect(body.data.isAdmin).toBe(true);
    expect(body.data.enabled).toBe(false);
    expect(body.data.siteKey).toBeNull();
  });

  it('keeps cookie-only admin detection and ignores bearer token', async () => {
    const env = createEnv();
    authMocks.verifyJWT.mockResolvedValue({ id: 'u-admin', type: 'admin', role: 'admin' });

    const request = new Request('https://example.com/api/turnstile/verify', {
      headers: {
        Authorization: 'Bearer "jwt.admin.bearer"',
      },
    });

    const response = await onRequestGet({ env, request });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authMocks.verifyJWT).not.toHaveBeenCalled();
    expect(body.data.isAdmin).toBe(false);
    expect(body.data.enabled).toBe(true);
    expect(body.data.siteKey).toBe('site-key');
  });
});
