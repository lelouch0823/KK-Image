import { describe, expect, it, vi } from 'vitest';

import {
  rateLimitMiddleware,
  rateLimit,
  checkLoginLockout,
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
  it('fails closed when global rate limit storage is unavailable', async () => {
    const c = createContext({});
    const next = vi.fn();

    const res = await rateLimitMiddleware(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
  });

  it('fails closed when route-scoped rate limit storage is unavailable', async () => {
    const c = createContext({});
    const next = vi.fn();

    const res = await rateLimit({ window: 1000, max: 1 })(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
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
});
