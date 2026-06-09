import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispose: vi.fn(async () => {}),
  getPlatformProxy: vi.fn(),
  onRequest: vi.fn(),
}));

vi.mock('wrangler', () => ({
  getPlatformProxy: mocks.getPlatformProxy,
}));

vi.mock('../functions/api/[[route]].js', () => ({
  onRequest: mocks.onRequest,
}));

describe('direct-pages-real-api utils', () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.__kkImageDirectPlatformProxyPromise;
    delete globalThis.__kkImageDirectFallbackCaches;
    mocks.dispose.mockClear();
    mocks.getPlatformProxy.mockReset();
    mocks.onRequest.mockReset();
    mocks.getPlatformProxy.mockResolvedValue({
      env: { DB: { name: 'test-db' } },
      dispose: mocks.dispose,
    });
  });

  it('reuses one platform proxy and flushes nested waitUntil tasks before returning', async () => {
    const events = [];
    let invocation = 0;

    mocks.onRequest.mockImplementation(async ({ request, env, waitUntil }) => {
      expect(env).toEqual(expect.objectContaining({ DB: { name: 'test-db' } }));
      invocation += 1;

      if (invocation === 1) {
        expect(request.url).toBe('http://127.0.0.1:8080/api/manage/products');
        expect(request.method).toBe('POST');
        expect(request.headers.get('authorization')).toBe('Bearer token-123');
        expect(request.headers.get('x-test-header')).toBe('direct');
        expect(await request.json()).toEqual({ name: 'Direct Product' });

        waitUntil(
          Promise.resolve().then(() => {
            events.push('first');
            waitUntil(
              Promise.resolve().then(() => {
                events.push('second');
              })
            );
          })
        );
      } else {
        expect(request.url).toBe('http://127.0.0.1:8080/api/manage/products?search=direct');
        expect(request.method).toBe('GET');
        expect(request.headers.get('authorization')).toBe('Bearer token-123');
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: { ok: true },
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    });

    const { directPageRequest } = await import('./utils/direct-pages-real-api.js');
    const created = await directPageRequest('/api/manage/products', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'X-Test-Header': 'direct',
      },
      body: { name: 'Direct Product' },
      flushWaitUntil: true,
    });

    expect(created.response.status).toBe(201);
    expect(created.json).toEqual({
      success: true,
      data: { ok: true },
    });
    expect(events).toEqual(['first', 'second']);

    await directPageRequest('/api/manage/products?search=direct', {
      headers: {
        Authorization: 'Bearer token-123',
      },
    });

    expect(mocks.getPlatformProxy).toHaveBeenCalledTimes(1);
    expect(mocks.onRequest).toHaveBeenCalledTimes(2);
  });

  it('overlays real API credentials from the current process onto the direct runtime env', async () => {
    const originalBasicUser = process.env.BASIC_USER;
    const originalBasicPass = process.env.BASIC_PASS;

    try {
      process.env.BASIC_USER = 'admin';
      process.env.BASIC_PASS = '123';
      vi.resetModules();

      mocks.onRequest.mockImplementation(async ({ env }) => {
        expect(env).toEqual(
          expect.objectContaining({
            DB: { name: 'test-db' },
            BASIC_USER: 'admin',
            BASIC_PASS: '123',
          })
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const { directPageRequest } = await import('./utils/direct-pages-real-api.js');
      await directPageRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { username: 'admin', password: '123' },
      });
    } finally {
      if (originalBasicUser === undefined) {
        delete process.env.BASIC_USER;
      } else {
        process.env.BASIC_USER = originalBasicUser;
      }
      if (originalBasicPass === undefined) {
        delete process.env.BASIC_PASS;
      } else {
        process.env.BASIC_PASS = originalBasicPass;
      }
    }
  });

  it('installs platform caches while handling a direct request and restores the prior global', async () => {
    const originalCaches = globalThis.caches;
    const hadCaches = Object.prototype.hasOwnProperty.call(globalThis, 'caches');
    const runtimeCaches = {
      default: {
        match: vi.fn(async () => undefined),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => true),
      },
    };

    try {
      delete globalThis.caches;
      vi.resetModules();
      mocks.getPlatformProxy.mockResolvedValueOnce({
        env: { DB: { name: 'test-db' } },
        caches: runtimeCaches,
        dispose: mocks.dispose,
      });
      mocks.onRequest.mockImplementation(async () => {
        expect(globalThis.caches).toBe(runtimeCaches);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const { directPageRequest } = await import('./utils/direct-pages-real-api.js');
      await directPageRequest('/api/sales/token/products');

      expect(globalThis.caches).toBeUndefined();
    } finally {
      if (hadCaches) {
        globalThis.caches = originalCaches;
      } else {
        delete globalThis.caches;
      }
    }
  });
});
