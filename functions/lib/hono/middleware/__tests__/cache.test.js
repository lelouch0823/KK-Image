import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../../../_shared/utils.js', async () => {
  const actual = await vi.importActual('../../../../_shared/utils.js');
  return {
    ...actual,
    sha256Hex: vi.fn(async () => 'mocked-hash-value'),
  };
});

import { sha256Hex } from '../../../../_shared/utils.js';
import { invalidateCache, withCache } from '../cache.js';

describe('cache middleware helpers', () => {
  let deleteMock;

  beforeEach(() => {
    deleteMock = vi.fn(async () => false);
    globalThis.caches = {
      default: {
        match: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
        delete: deleteMock,
      },
    };
    vi.clearAllMocks();
  });

  it('invalidates cache entries created with the json Accept header key', async () => {
    await invalidateCache('https://example.com/api/manage/customers?limit=20&page=1');

    expect(deleteMock).toHaveBeenCalledWith(expect.any(Request));

    const request = deleteMock.mock.calls[0][0];
    expect(request.url).toBe('https://example.com/api/manage/customers?limit=20&page=1');
    expect(request.headers.get('Accept')).toBe('application/json');
  });

  it('does not hash response bodies when default cache mode is used', async () => {
    const middleware = withCache(60);
    const waitUntil = vi.fn();
    const context = {
      req: {
        method: 'GET',
        url: 'https://example.com/api/manage/stats',
        header: vi.fn((name) => (name === 'Accept' ? 'application/json' : null)),
      },
      executionCtx: { waitUntil },
      res: null,
    };

    await middleware(context, async () => {
      context.res = Response.json({ ok: true });
    });

    expect(sha256Hex).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('computes body-hash etags only when explicitly enabled', async () => {
    const middleware = withCache(60, { etagMode: 'body-hash' });
    const waitUntil = vi.fn();
    const context = {
      req: {
        method: 'GET',
        url: 'https://example.com/api/manage/stats',
        header: vi.fn((name) => (name === 'Accept' ? 'application/json' : null)),
      },
      executionCtx: { waitUntil },
      res: null,
    };

    await middleware(context, async () => {
      context.res = Response.json({ ok: true });
    });

    expect(sha256Hex).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('keeps response bodies readable after cache miss processing', async () => {
    const app = new Hono();
    app.get('/stats', withCache(60), (c) => c.json({ success: true, items: ['tagA'] }));

    const res = await app.request(
      'https://example.com/stats',
      undefined,
      {},
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, items: ['tagA'] });
  });
});
