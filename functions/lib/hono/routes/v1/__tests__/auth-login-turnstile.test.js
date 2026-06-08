import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  generateJWT: vi.fn(),
  verifyTurnstile: vi.fn(),
  checkAndRespondLockout: vi.fn(),
  handleLoginFailure: vi.fn(),
  clearFailures: vi.fn(),
  authenticateAdminUser: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../_shared/utils.js', () => ({
  generateJWT: mocks.generateJWT,
  ADMIN_AUTH_COOKIE: 'ADMIN_AUTH',
  verifyTurnstile: mocks.verifyTurnstile,
  MSG: {
    AUTH: {
      VERIFY_FAILED: 'VERIFY_FAILED',
      VERIFY_ERROR: 'VERIFY_ERROR',
      UNCONFIGURED: 'UNCONFIGURED',
      REQUIRED: 'REQUIRED',
    },
    USER: {
      NAME_REQUIRED: 'NAME_REQUIRED',
      PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
      INVALID_CHARS: 'INVALID_CHARS',
    },
  },
}));

vi.mock('../../../middleware/rateLimit.js', () => ({
  loginRateLimitMiddleware: async (_c, next) => next(),
}));

vi.mock('../../../_shared/auth-helpers.js', () => ({
  checkAndRespondLockout: mocks.checkAndRespondLockout,
  handleLoginFailure: mocks.handleLoginFailure,
  clearFailures: mocks.clearFailures,
  authenticateAdminUser: mocks.authenticateAdminUser,
}));

vi.mock('../../../_shared/audit-helpers.js', () => ({
  scheduleAuditEvent: mocks.scheduleAuditEvent,
}));

import authApp from '../auth.js';

function createApp() {
  const app = new Hono();
  app.route('/api/v1/auth', authApp);
  return app;
}

describe('v1 auth login Turnstile configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAndRespondLockout.mockResolvedValue(null);
    mocks.authenticateAdminUser.mockResolvedValue({
      id: 'admin',
      name: 'Administrator',
      type: 'admin',
      role: 'admin',
      permissions: ['admin:full'],
    });
    mocks.generateJWT.mockResolvedValue('jwt-token');
    mocks.verifyTurnstile.mockResolvedValue(true);
  });

  it('fails closed in production when Turnstile secret is missing before checking credentials', async () => {
    const app = createApp();

    const response = await app.request(
      'https://example.com/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'correct-password',
          turnstileToken: 'client-token',
        }),
      },
      {
        ENVIRONMENT: 'production',
        BASIC_USER: 'admin',
        BASIC_PASS: 'correct-password',
        JWT_SECRET: 'secret',
        DB: {},
      }
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'VERIFY_ERROR',
    });
    expect(mocks.authenticateAdminUser).not.toHaveBeenCalled();
    expect(mocks.generateJWT).not.toHaveBeenCalled();
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });
});
