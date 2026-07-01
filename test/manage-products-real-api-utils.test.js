import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadRealApiUtils({ fetchImpl } = {}) {
  vi.resetModules();
  vi.doUnmock('node-fetch');
  if (fetchImpl) {
    vi.doMock('node-fetch', () => ({
      default: fetchImpl,
    }));
  }
  return import('./utils/manage-products-real-api.js');
}

function createJsonResponse(status, payload, headers = {}) {
  const createHeaders = () => ({
    get(name) {
      return headers[String(name || '').toLowerCase()] ?? null;
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
      return headers[String(name || '').toLowerCase()] ?? null;
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

describe('manage-products-real-api utils', () => {
  afterEach(() => {
    delete globalThis.__kkImageRealApiBearerTokenPromise;
    delete process.env.REAL_API_SALES_DIRECT;
    delete process.env.REAL_API_TRANSPORT;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
    vi.doUnmock('node-fetch');
    vi.doUnmock('./utils/direct-pages-real-api.js');
  });

  it('exports multipartRequest for multipart real-api workflows', async () => {
    const realApiUtils = await loadRealApiUtils();
    expect(typeof realApiUtils.multipartRequest).toBe('function');
  });

  it('rebuilds multipart form data for each retry after rate limiting', async () => {
    vi.useFakeTimers();
    const healthFetchMock = vi
      .fn()
      .mockResolvedValue(createJsonResponse(200, { status: 'healthy' }));
    vi.stubGlobal('fetch', healthFetchMock);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(429, { success: false }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }));
    const realApiUtils = await loadRealApiUtils({ fetchImpl: fetchMock });

    const requestPromise = realApiUtils.multipartRequest('/api/manage/folders/test/upload', {
      bearerToken: 'token-123',
      expectedStatus: 200,
      fields: {
        file: {
          value: 'fake-image-data',
          filename: 'retry-test.jpg',
          contentType: 'image/jpeg',
        },
        note: 'retry check',
      },
    });

    await vi.runAllTimersAsync();
    await requestPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/manage/folders/test/upload');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123');
    expect(fetchMock.mock.calls[0][1].body).not.toBe(fetchMock.mock.calls[1][1].body);
    expect(healthFetchMock).toHaveBeenCalledTimes(1);
    expect(healthFetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/v1/health');
  });

  it('waits for loopback runtime recovery after successful purchase-order status mutations', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }))
      .mockResolvedValueOnce(createJsonResponse(503, { success: false }))
      .mockResolvedValueOnce(createJsonResponse(200, { status: 'healthy' }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.BASE_URL = 'http://127.0.0.1:8080';

    const realApiUtils = await loadRealApiUtils();
    const requestPromise = realApiUtils.apiRequest('/api/manage/purchase-orders/po-1/status', {
      method: 'PATCH',
      body: { status: 'ordered' },
      expectedStatus: 200,
      bearerToken: 'token-123',
    });

    await vi.runAllTimersAsync();
    await requestPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8080/api/manage/purchase-orders/po-1/status'
    );
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8080/api/v1/health');
    expect(fetchMock.mock.calls[2][0]).toBe('http://127.0.0.1:8080/api/v1/health');
  });

  it('retries loopback api write requests after workerd restarts mid-request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createTextResponse(
          503,
          'Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.'
        )
      )
      .mockResolvedValueOnce(createJsonResponse(200, { status: 'healthy' }))
      .mockResolvedValueOnce(createJsonResponse(201, { success: true, data: { ok: true } }))
      .mockResolvedValueOnce(createJsonResponse(200, { status: 'healthy' }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.BASE_URL = 'http://127.0.0.1:8080';

    const realApiUtils = await loadRealApiUtils();
    const result = await realApiUtils.apiRequest('/api/manage/products', {
      method: 'POST',
      body: { name: 'Retry Product' },
      expectedStatus: 201,
      bearerToken: 'token-123',
    });

    expect(result.response.status).toBe(201);
    expect(result.json?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/manage/products');
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8080/api/v1/health');
    expect(fetchMock.mock.calls[2][0]).toBe('http://127.0.0.1:8080/api/manage/products');
    expect(fetchMock.mock.calls[3][0]).toBe('http://127.0.0.1:8080/api/v1/health');
  });

  it('sends a dedicated forwarded ip when logging in for real api tests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(
          200,
          { success: true, data: { ok: true } },
          { 'set-cookie': 'ADMIN_AUTH=test-cookie-token; Path=/; HttpOnly' }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.ADMIN_TOKEN;
    process.env.BASE_URL = 'http://127.0.0.1:8080';

    const realApiUtils = await loadRealApiUtils();
    const token = await realApiUtils.getBearerToken();

    expect(token).toBe('test-cookie-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers['X-Forwarded-For']).toMatch(/^10\.\d+\.\d+\.\d+$/);
  });

  it('retries admin login after loopback workerd restarts mid-request', async () => {
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
          { success: true },
          { 'set-cookie': 'ADMIN_AUTH=recovered-cookie-token; Path=/; HttpOnly' }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.ADMIN_TOKEN;
    process.env.BASE_URL = 'http://127.0.0.1:8080';

    const realApiUtils = await loadRealApiUtils();
    const token = await realApiUtils.getBearerToken();

    expect(token).toBe('recovered-cookie-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/v1/auth/login');
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8080/api/v1/health');
    expect(fetchMock.mock.calls[2][0]).toBe('http://127.0.0.1:8080/api/v1/auth/login');
  });

  it('routes json api requests through direct pages transport when REAL_API_TRANSPORT=direct', async () => {
    process.env.REAL_API_TRANSPORT = 'direct';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const directPageRequest = vi.fn().mockResolvedValue({
      response: createJsonResponse(201, { success: true, data: { id: 'product-1' } }),
      json: { success: true, data: { id: 'product-1' } },
      text: null,
    });
    vi.doMock('./utils/direct-pages-real-api.js', () => ({
      directPageRequest,
    }));

    const realApiUtils = await loadRealApiUtils();
    const result = await realApiUtils.apiRequest('/api/manage/products', {
      method: 'POST',
      body: { name: 'Direct Product' },
      expectedStatus: 201,
      bearerToken: 'token-123',
    });

    expect(result.json?.data?.id).toBe('product-1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(directPageRequest).toHaveBeenCalledWith(
      '/api/manage/products',
      expect.objectContaining({
        method: 'POST',
        body: { name: 'Direct Product' },
        flushWaitUntil: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('flushes waitUntil for direct GET requests so cache assertions are deterministic', async () => {
    process.env.REAL_API_TRANSPORT = 'direct';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const directPageRequest = vi.fn().mockResolvedValue({
      response: createJsonResponse(200, { success: true, data: { totalOrders: 0 } }),
      json: { success: true, data: { totalOrders: 0 } },
      text: null,
    });
    vi.doMock('./utils/direct-pages-real-api.js', () => ({
      directPageRequest,
    }));

    const realApiUtils = await loadRealApiUtils();
    await realApiUtils.apiRequest('/api/sales/access-token/stats', {
      authHeader: 'Bearer sales-jwt',
      expectedStatus: 200,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(directPageRequest).toHaveBeenCalledWith(
      '/api/sales/access-token/stats',
      expect.objectContaining({
        method: 'GET',
        flushWaitUntil: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer sales-jwt',
        }),
      })
    );
  });

  it('routes multipart requests through direct pages transport when REAL_API_TRANSPORT=direct', async () => {
    process.env.REAL_API_TRANSPORT = 'direct';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const directPageRequest = vi.fn().mockResolvedValue({
      response: createJsonResponse(200, { success: true, data: { id: 'file-1' } }),
      json: { success: true, data: { id: 'file-1' } },
      text: null,
    });
    vi.doMock('./utils/direct-pages-real-api.js', () => ({
      directPageRequest,
    }));

    const realApiUtils = await loadRealApiUtils();
    const result = await realApiUtils.multipartRequest('/api/manage/upload', {
      bearerToken: 'token-123',
      expectedStatus: 200,
      fields: {
        file: {
          value: 'direct-upload-body',
          filename: 'direct-upload.txt',
          contentType: 'text/plain',
        },
        note: 'direct multipart',
      },
    });

    expect(result.json?.data?.id).toBe('file-1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(directPageRequest).toHaveBeenCalledWith(
      '/api/manage/upload',
      expect.objectContaining({
        method: 'POST',
        flushWaitUntil: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
    const body = directPageRequest.mock.calls[0][1].body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('note')).toBe('direct multipart');
    const file = body.get('file');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('direct-upload.txt');
    expect(file.type).toBe('text/plain');
    expect(file.size).toBe('direct-upload-body'.length);
  });

  it('uses direct pages transport for admin login when REAL_API_TRANSPORT=direct', async () => {
    process.env.REAL_API_TRANSPORT = 'direct';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const directPageRequest = vi.fn().mockResolvedValue({
      response: createJsonResponse(
        200,
        { success: true },
        { 'set-cookie': 'ADMIN_AUTH=direct-cookie-token; Path=/; HttpOnly' }
      ),
      json: { success: true },
      text: null,
    });
    vi.doMock('./utils/direct-pages-real-api.js', () => ({
      directPageRequest,
    }));

    const realApiUtils = await loadRealApiUtils();
    const token = await realApiUtils.getBearerToken();

    expect(token).toBe('direct-cookie-token');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(directPageRequest).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        flushWaitUntil: true,
        body: {
          username: 'admin',
          password: '123',
        },
      })
    );
  });

  it('enables direct sales-flow transport only when REAL_API_SALES_DIRECT=1', async () => {
    process.env.REAL_API_SALES_DIRECT = '1';
    const realApiUtils = await loadRealApiUtils();
    expect(realApiUtils.shouldUseDirectSalesFlowTransport()).toBe(true);

    delete process.env.REAL_API_SALES_DIRECT;
    const reloaded = await loadRealApiUtils();
    expect(reloaded.shouldUseDirectSalesFlowTransport()).toBe(false);
  });

  it('temporarily scopes REAL_API_TRANSPORT for a callback and restores the previous value', async () => {
    process.env.REAL_API_TRANSPORT = 'http';
    const realApiUtils = await loadRealApiUtils();
    const seen = [];

    await realApiUtils.withScopedRealApiTransport('direct', async () => {
      seen.push(process.env.REAL_API_TRANSPORT);
    });

    expect(seen).toEqual(['direct']);
    expect(process.env.REAL_API_TRANSPORT).toBe('http');
  });
});
