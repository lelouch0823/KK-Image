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

describe('manage-products-real-api utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
    vi.doUnmock('node-fetch');
  });

  it('exports multipartRequest for multipart real-api workflows', async () => {
    const realApiUtils = await loadRealApiUtils();
    expect(typeof realApiUtils.multipartRequest).toBe('function');
  });

  it('rebuilds multipart form data for each retry after rate limiting', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: () => null },
        json: async () => ({ success: false }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: () => null },
        json: async () => ({ success: true }),
      });
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
  });
});
