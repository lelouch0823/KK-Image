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
      expect(env).toEqual({ DB: { name: 'test-db' } });
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
});
