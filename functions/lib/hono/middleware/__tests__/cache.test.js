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

  it('invalidates by bumping the scope generation instead of URL deletes', async () => {
    const putMock = vi.fn(async () => undefined);
    globalThis.caches.default.put = putMock;
    const env = {
      KV: {
        get: vi.fn(async () => null),
        put: putMock,
      },
    };

    // 多个 URL 属同一 resource scope → 归并为一次代际递增
    await invalidateCache(
      [
        'https://example.com/api/manage/customers?limit=20&page=1',
        'https://example.com/api/manage/customers?page=2&limit=20',
      ],
      env
    );

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0][0]).toBe('cache:gen:api:manage:customers');
    // 代际失效不再做 URL 级 cache.delete（P-H1）
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('normalizes query parameter ordering for cache invalidation keys', async () => {
    // 不同 query 顺序同属一个 scope：推导结果一致
    const { scopeFromUrl } = await import('../../_shared/cache-generation.js');
    expect(scopeFromUrl('https://example.com/api/manage/customers?limit=20&page=1')).toBe(
      scopeFromUrl('https://example.com/api/manage/customers?page=1&limit=20')
    );
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
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, items: ['tagA'] });
  });

  it('skips cache writes when a request does not satisfy the cache condition', async () => {
    const app = new Hono();
    const waitUntil = vi.fn();
    app.get(
      '/products',
      withCache(60, { condition: (c) => !String(c.req.query('search') || '').trim() }),
      (c) => c.json({ success: true })
    );

    const searched = await app.request(
      'https://example.com/products?search=tee',
      undefined,
      {},
      { waitUntil, passThroughOnException: vi.fn() }
    );

    expect(searched.status).toBe(200);
    expect(searched.headers.get('X-Cache')).toBeNull();
    expect(waitUntil).not.toHaveBeenCalled();

    await app.request(
      'https://example.com/products',
      undefined,
      {},
      { waitUntil, passThroughOnException: vi.fn() }
    );

    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});
