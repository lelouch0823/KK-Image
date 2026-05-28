import { describe, expect, it, vi } from 'vitest';

import {
  clearLoginFailures,
  formatRetryAfter,
  rateLimitMiddleware,
  rateLimit,
  checkLoginLockout,
  loginRateLimitMiddleware,
  recordLoginFailure,
  resolveRequestIp,
} from '../rateLimit.js';

function createContext(env = {}) {
  const headers = new Headers();
  return {
    env,
    req: {
      header: (name) => headers.get(name),
      url: 'http://127.0.0.1:8080/api/manage/products',
    },
    executionCtx: {
      waitUntil: vi.fn(),
    },
    json: vi.fn((payload, status = 200) => new Response(JSON.stringify(payload), { status })),
    header: vi.fn(),
  };
}

describe('rateLimit middleware', () => {
  it('fails open when global rate limit storage is unavailable', async () => {
    const c = createContext({});
    const next = vi.fn();

    const res = await rateLimitMiddleware(c, next);

    expect(next).toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  it('fails open when route-scoped rate limit storage is unavailable', async () => {
    const c = createContext({});
    const next = vi.fn();

    const res = await rateLimit({ window: 1000, max: 1 })(c, next);

    expect(next).toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  it('skips global rate limit only for loopback requests carrying the real-api bypass header', async () => {
    const c = createContext({});
    c.req.header = (name) => {
      if (name === 'X-Test-Bypass-RateLimit') return '1';
      return null;
    };
    const next = vi.fn();

    const res = await rateLimitMiddleware(c, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res).toBeUndefined();
  });

  it('does not bypass rate limit in production environment even with bypass header', async () => {
    const c = createContext({
      ENVIRONMENT: 'production',
      RATE_LIMIT_KV: {
        get: vi.fn().mockResolvedValue('0'),
        put: vi.fn(async () => undefined),
      },
    });
    c.req.header = (name) => {
      if (name === 'X-Test-Bypass-RateLimit') return '1';
      return null;
    };
    const next = vi.fn(async () => undefined);

    // production 环境下 bypass header 不生效，正常执行限流逻辑
    const res = await rateLimitMiddleware(c, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(c.header).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
  });

  it('prefers forwarded test ip over CF loopback ip when resolving loopback requests', () => {
    const c = createContext({});
    c.req.header = (name) => {
      if (name === 'CF-Connecting-IP') return '127.0.0.1';
      if (name === 'X-Forwarded-For') return '10.20.30.40';
      return null;
    };

    expect(resolveRequestIp(c.req)).toBe('10.20.30.40');
  });

  it('keeps CF ip priority for non-loopback requests', () => {
    const c = createContext({});
    c.req.url = 'https://example.com/api/v1/auth/login';
    c.req.header = (name) => {
      if (name === 'CF-Connecting-IP') return '203.0.113.10';
      if (name === 'X-Forwarded-For') return '10.20.30.40';
      return null;
    };

    expect(resolveRequestIp(c.req)).toBe('203.0.113.10');
  });

  it('marks login lockout helpers unavailable when KV is missing', async () => {
    await expect(checkLoginLockout(null, '127.0.0.1', 'user')).resolves.toMatchObject({
      unavailable: true,
    });
    await expect(recordLoginFailure(null, '127.0.0.1', 'user')).resolves.toMatchObject({
      unavailable: true,
    });
  });

  it('records successful global rate-limit usage and returns 429 when the window is exhausted', async () => {
    const c = createContext({
      RATE_LIMIT_KV: {
        get: vi.fn().mockResolvedValueOnce('2').mockResolvedValueOnce('100'),
        put: vi.fn(async () => undefined),
      },
    });
    const next = vi.fn(async () => undefined);

    await expect(rateLimitMiddleware(c, next)).resolves.toBeUndefined();
    expect(c.executionCtx.waitUntil).toHaveBeenCalled();
    expect(c.header).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(c.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '97');

    const limited = await rateLimitMiddleware(c, next);
    expect(limited.status).toBe(429);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports login-scoped rate limits, lockout state transitions, and cleanup', async () => {
    const now = Date.now();
    const kv = {
      get: vi
        .fn()
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce({ attempts: 2, lockedUntil: null })
        .mockResolvedValueOnce({ attempts: 5, lockedUntil: now + 60_000 })
        .mockResolvedValueOnce({ attempts: 5, lockedUntil: now - 1 }),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };

    const c = createContext({ RATE_LIMIT_KV: kv });
    const next = vi.fn(async () => undefined);
    await expect(loginRateLimitMiddleware(c, next)).resolves.toBeUndefined();

    await expect(checkLoginLockout(kv, '127.0.0.1', 'demo')).resolves.toEqual({
      locked: false,
      remaining: 3,
      retryAfter: 0,
    });
    await expect(checkLoginLockout(kv, '127.0.0.1', 'demo')).resolves.toMatchObject({
      locked: true,
      retryAfter: 60,
    });
    await expect(checkLoginLockout(kv, '127.0.0.1', 'demo')).resolves.toEqual({
      locked: false,
      remaining: 5,
      retryAfter: 0,
    });

    await expect(recordLoginFailure(kv, '127.0.0.1', 'demo', c.executionCtx)).resolves.toEqual({
      locked: false,
      remaining: 4,
      retryAfter: 0,
    });

    const lockKv = {
      get: vi.fn(async () => ({ attempts: 4, lockedUntil: null })),
      put: vi.fn(async () => undefined),
    };
    await expect(recordLoginFailure(lockKv, '127.0.0.1', 'demo', null)).resolves.toEqual({
      locked: true,
      remaining: 0,
      retryAfter: 900,
    });

    await clearLoginFailures(kv, '127.0.0.1', 'demo', c.executionCtx);
    expect(kv.delete).toHaveBeenCalledWith('login_lockout:127.0.0.1:demo');
  });

  it('formats retry durations for seconds, minutes, and hours', () => {
    expect(formatRetryAfter(0)).toBe('现在');
    expect(formatRetryAfter(8)).toBe('8秒');
    expect(formatRetryAfter(90)).toBe('1分30秒');
    expect(formatRetryAfter(3600)).toBe('1小时');
    expect(formatRetryAfter(3660)).toBe('1小时1分钟');
  });
});
