import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadSalesRealApiUtils({ fetchImpl, multipartFetchImpl } = {}) {
  vi.resetModules();
  vi.doUnmock('node-fetch');

  if (multipartFetchImpl) {
    vi.doMock('node-fetch', () => ({
      default: multipartFetchImpl,
    }));
  }

  if (fetchImpl) {
    vi.stubGlobal('fetch', fetchImpl);
  }

  return import('./utils/sales-real-api.js');
}

function createJsonResponse(status, payload, headers = {}) {
  return {
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    json: async () => payload,
  };
}

describe('sales-real-api utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
    vi.doUnmock('node-fetch');
  });

  it('retries sales api requests after rate limiting', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonResponse(429, { success: false, retryAfter: 1 }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true, data: { ok: true } }));
    const salesRealApiUtils = await loadSalesRealApiUtils({ fetchImpl: fetchMock });

    const requestPromise = salesRealApiUtils.salesApiRequest(
      'sales-access-token',
      'sales-jwt-token',
      '/api/sales/sales-access-token/notifications?limit=50',
      { expectedStatus: 200 }
    );

    await vi.runAllTimersAsync();
    const result = await requestPromise;

    expect(result.json?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/sales/sales-access-token/notifications?limit=50');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sales-jwt-token');
  });

  it('rebuilds sales multipart form data for each retry after rate limiting', async () => {
    vi.useFakeTimers();
    const multipartFetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonResponse(429, { success: false }, { 'retry-after': '1' }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }));
    const salesRealApiUtils = await loadSalesRealApiUtils({ multipartFetchImpl: multipartFetchMock });

    const requestPromise = salesRealApiUtils.salesMultipartRequest('/api/sales/access/upload', {
      authToken: 'sales-jwt-token',
      expectedStatus: 200,
      fields: {
        file: {
          value: 'fake-image-data',
          filename: 'sales-retry-test.jpg',
          contentType: 'image/jpeg',
        },
        purpose: 'retry check',
      },
    });

    await vi.runAllTimersAsync();
    await requestPromise;

    expect(multipartFetchMock).toHaveBeenCalledTimes(2);
    expect(multipartFetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/sales/access/upload');
    expect(multipartFetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sales-jwt-token');
    expect(multipartFetchMock.mock.calls[0][1].body).not.toBe(multipartFetchMock.mock.calls[1][1].body);
  });

  it('retries sales login after rate limiting and returns auth artifacts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createJsonResponse(429, { success: false, retryAfter: 1 }, { 'retry-after': '1' }))
      .mockResolvedValueOnce(createJsonResponse(
        200,
        { success: true, data: { token: 'sales-jwt-token' } },
        { 'set-cookie': 'SALES_AUTH=sales-cookie; Path=/; HttpOnly' }
      ));
    const salesRealApiUtils = await loadSalesRealApiUtils({ fetchImpl: fetchMock });

    const loginPromise = salesRealApiUtils.loginSalesperson('sales-access-token', '123456');

    await vi.runAllTimersAsync();
    const login = await loginPromise;

    expect(login.token).toBe('sales-jwt-token');
    expect(login.cookie).toBe('SALES_AUTH=sales-cookie');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/sales/sales-access-token/auth');
  });
});
