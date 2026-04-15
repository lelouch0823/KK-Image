import { describe, expect, it, vi } from 'vitest';

import {
  rateLimitMiddleware,
  rateLimit,
  checkLoginLockout,
  recordLoginFailure,
} from '../rateLimit.js';

function createContext(env = {}) {
  const headers = new Headers();
  return {
    env,
    req: {
      header: (name) => headers.get(name),
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

  it('marks login lockout helpers unavailable when KV is missing', async () => {
    await expect(checkLoginLockout(null, '127.0.0.1', 'user')).resolves.toMatchObject({
      unavailable: true,
    });
    await expect(recordLoginFailure(null, '127.0.0.1', 'user')).resolves.toMatchObject({
      unavailable: true,
    });
  });
});
