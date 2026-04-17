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
  const createHeaders = () => ({
    get(name) {
      return headers[name.toLowerCase()] ?? null;
    },
  });

  return {
    status,
    headers: createHeaders(),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    clone() {
      return {
        status,
        headers: createHeaders(),
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    },
  };
}

function createTextResponse(status, text, headers = {}) {
  const createHeaders = () => ({
    get(name) {
      return headers[name.toLowerCase()] ?? null;
    },
  });

  return {
    status,
    headers: createHeaders(),
    json: async () => {
      throw new Error('not json');
    },
    text: async () => text,
    clone() {
      return {
        status,
        headers: createHeaders(),
        json: async () => {
          throw new Error('not json');
        },
        text: async () => text,
      };
    },
  };
}

describe('sales-real-api utils', () => {
  afterEach(() => {
    delete process.env.REAL_API_TRANSPORT;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
    vi.doUnmock('node-fetch');
    vi.doUnmock('./utils/direct-pages-real-api.js');
  });

  it('retries sales api requests after rate limiting', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
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
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8080/api/sales/sales-access-token/notifications?limit=50'
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sales-jwt-token');
  });

  it('rebuilds sales multipart form data for each retry after rate limiting', async () => {
    vi.useFakeTimers();
    const healthFetchMock = vi
      .fn()
      .mockResolvedValue(createJsonResponse(200, { status: 'healthy' }));
    vi.stubGlobal('fetch', healthFetchMock);
    const multipartFetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(429, { success: false }, { 'retry-after': '1' }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }));
    const salesRealApiUtils = await loadSalesRealApiUtils({
      multipartFetchImpl: multipartFetchMock,
    });

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
    expect(multipartFetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8080/api/sales/access/upload'
    );
    expect(multipartFetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer sales-jwt-token'
    );
    expect(multipartFetchMock.mock.calls[0][1].body).not.toBe(
      multipartFetchMock.mock.calls[1][1].body
    );
    expect(healthFetchMock).toHaveBeenCalledTimes(1);
    expect(healthFetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/v1/health');
  });

  it('retries sales login after rate limiting and returns auth artifacts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(429, { success: false, retryAfter: 1 }, { 'retry-after': '1' })
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          200,
          { success: true, data: { token: 'sales-jwt-token' } },
          { 'set-cookie': 'SALES_AUTH=sales-cookie; Path=/; HttpOnly' }
        )
      );
    const salesRealApiUtils = await loadSalesRealApiUtils({ fetchImpl: fetchMock });

    const loginPromise = salesRealApiUtils.loginSalesperson('sales-access-token', '123456');

    await vi.runAllTimersAsync();
    const login = await loginPromise;

    expect(login.token).toBe('sales-jwt-token');
    expect(login.cookie).toBe('SALES_AUTH=sales-cookie');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8080/api/sales/sales-access-token/auth'
    );
    expect(fetchMock.mock.calls[0][1].headers['X-Forwarded-For']).toMatch(/^10\.\d+\.\d+\.\d+$/);
  });

  it('retries sales login after loopback workerd restarts mid-request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createTextResponse(
          503,
          'Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.'
        )
      )
      .mockResolvedValueOnce(createJsonResponse(200, { status: 'healthy' }))
      .mockResolvedValueOnce(
        createJsonResponse(
          200,
          { success: true, data: { token: 'sales-jwt-token' } },
          { 'set-cookie': 'SALES_AUTH=sales-cookie; Path=/; HttpOnly' }
        )
      );
    const salesRealApiUtils = await loadSalesRealApiUtils({ fetchImpl: fetchMock });

    const login = await salesRealApiUtils.loginSalesperson('sales-access-token', '123456');

    expect(login.token).toBe('sales-jwt-token');
    expect(login.cookie).toBe('SALES_AUTH=sales-cookie');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8080/api/sales/sales-access-token/auth'
    );
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8080/api/v1/health');
    expect(fetchMock.mock.calls[2][0]).toBe(
      'http://127.0.0.1:8080/api/sales/sales-access-token/auth'
    );
  });

  it('uses direct pages transport for sales login when REAL_API_TRANSPORT=direct', async () => {
    process.env.REAL_API_TRANSPORT = 'direct';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const directPageRequest = vi.fn().mockResolvedValue({
      response: createJsonResponse(
        200,
        { success: true, data: { token: 'sales-direct-jwt' } },
        { 'set-cookie': 'SALES_AUTH=direct-sales-cookie; Path=/; HttpOnly' }
      ),
      json: { success: true, data: { token: 'sales-direct-jwt' } },
      text: null,
    });
    vi.doMock('./utils/direct-pages-real-api.js', () => ({
      directPageRequest,
    }));

    const salesRealApiUtils = await loadSalesRealApiUtils();
    const login = await salesRealApiUtils.loginSalesperson('sales-access-token', '123456');

    expect(login.token).toBe('sales-direct-jwt');
    expect(login.cookie).toBe('SALES_AUTH=direct-sales-cookie');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(directPageRequest).toHaveBeenCalledWith(
      '/api/sales/sales-access-token/auth',
      expect.objectContaining({
        method: 'POST',
        flushWaitUntil: true,
        body: { password: '123456' },
      })
    );
  });
});
