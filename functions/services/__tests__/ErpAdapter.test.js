import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenericRestAdapter } from '../ErpAdapter.js';

describe('GenericRestAdapter request safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects private ERP base URLs before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new GenericRestAdapter({
      baseUrl: 'http://169.254.169.254',
      authType: 'api_key',
      credentials: { apiKey: 'secret' },
    });

    await expect(adapter.testConnection()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('内网地址'),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not follow redirects automatically when calling ERP endpoints', async () => {
    const fetchMock = vi.fn(async () => new Response('{"items":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new GenericRestAdapter({
      baseUrl: 'https://erp.example.com',
      authType: 'api_key',
      credentials: { apiKey: 'secret' },
    });

    await adapter.listRemote('product', { limit: 1, page: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://erp.example.com/api/products?limit=1&page=1',
      expect.objectContaining({
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      })
    );
  });
});
