import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkLoginLockout: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
  formatRetryAfter: vi.fn(() => '5 minutes'),
  resolveRequestIp: vi.fn(() => '127.0.0.1'),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../middleware/rateLimit.js', () => ({
  checkLoginLockout: mocks.checkLoginLockout,
  recordLoginFailure: mocks.recordLoginFailure,
  clearLoginFailures: mocks.clearLoginFailures,
  formatRetryAfter: mocks.formatRetryAfter,
  resolveRequestIp: mocks.resolveRequestIp,
}));

vi.mock('../audit-helpers.js', async () => {
  const actual = await vi.importActual('../audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import { checkAndRespondLockout, handleLoginFailure } from '../auth-helpers.js';

function createContext() {
  return {
    env: {
      RATE_LIMIT_KV: {},
      KV: {},
    },
    req: {
      url: 'https://example.com/api/sales/login',
      header: vi.fn(() => null),
    },
    json: vi.fn((body, status) => ({ body, status })),
    executionCtx: { waitUntil: vi.fn() },
  };
}

describe('auth helpers audit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records lockout audit when login is already locked', async () => {
    mocks.checkLoginLockout.mockResolvedValue({ locked: true, retryAfter: 300 });
    const c = createContext();

    const response = await checkAndRespondLockout(c, 'sales-a');

    expect(response.status).toBe(429);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      c,
      expect.objectContaining({ action: 'sales.auth.locked', result: 'denied' })
    );
  });

  it('records failed audit when login failure does not yet lock the account', async () => {
    mocks.recordLoginFailure.mockResolvedValue({ locked: false, remaining: 2 });
    const c = createContext();

    const response = await handleLoginFailure(c, 'sales-a');

    expect(response.status).toBe(401);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      c,
      expect.objectContaining({ action: 'sales.auth.failed', result: 'failed' })
    );
  });
});
