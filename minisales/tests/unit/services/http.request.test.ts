import { describe, expect, it, vi } from 'vitest';
import { installMockWx } from '../../setup/wx';
import { salesRequest } from '../../../miniprogram/services/http/request';
import { request as compatRequest } from '../../../miniprogram/utils/api';

describe('salesRequest', () => {
  it('injects bearer token and unwraps success payload', async () => {
    const requestSpy = vi.fn(({ success }: { success?: (res: unknown) => void }) =>
      success?.({
        statusCode: 200,
        data: { success: true, data: { orders: [] } },
      })
    );

    installMockWx({
      getStorageSync: vi.fn((key: string) => (key === 'sales_token' ? 'jwt-1' : '')),
      request: requestSpy,
    });

    const result = await salesRequest<{ orders: unknown[] }>({
      path: '/api/sales/token-1/orders',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ orders: [] });
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          Authorization: 'Bearer jwt-1',
        }),
      })
    );
  });

  it('normalizes backend error payloads into a stable shape', async () => {
    installMockWx({
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 403,
          data: { success: false, error: 'forbidden', code: 'FORBIDDEN' },
        })
      ),
    });

    const result = await salesRequest({
      path: '/api/sales/token-1/orders',
    });

    expect(result).toMatchObject({
      success: false,
      error: 'forbidden',
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('treats 2xx payload without success field as success', async () => {
    installMockWx({
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 200,
          data: { data: { orders: [] } },
        })
      ),
    });

    const result = await salesRequest<{ orders: unknown[] }>({
      path: '/api/sales/token-1/orders',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ orders: [] });
  });

  it('normalizes wx.request fail with network detail', async () => {
    installMockWx({
      request: vi.fn(({ fail }: { fail?: (res: unknown) => void }) =>
        fail?.({
          errMsg: 'request:fail timeout',
        })
      ),
    });

    const result = await salesRequest({
      path: '/api/sales/token-1/orders',
    });

    expect(result).toMatchObject({
      success: false,
      code: 'NETWORK_ERROR',
      status: 0,
      detail: 'request:fail timeout',
    });
  });
});

describe('utils/api request compatibility bridge', () => {
  it('preserves extra fields on successful 2xx responses', async () => {
    installMockWx({
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 200,
          data: {
            success: false,
            data: { orders: [] },
            pagination: { page: 1, total: 10 },
          },
        })
      ),
    });

    const response = await compatRequest<{ orders: unknown[] }>('/api/sales/token-1/orders');

    expect(response.success).toBe(false);
    expect(response.pagination).toEqual({ page: 1, total: 10 });
  });

  it('rejects non-2xx responses and keeps legacy side effects', async () => {
    const toastSpy = vi.fn();
    installMockWx({
      showToast: toastSpy,
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 403,
          data: { success: false, error: 'forbidden' },
        })
      ),
    });

    await expect(compatRequest('/api/sales/token-1/orders')).rejects.toThrow('forbidden');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'forbidden' }));
  });

  it('rejects 401 responses and redirects to login', async () => {
    const redirectSpy = vi.fn();
    const removeStorageSpy = vi.fn();
    installMockWx({
      redirectTo: redirectSpy,
      removeStorageSync: removeStorageSpy,
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 401,
          data: { success: false, error: 'expired' },
        })
      ),
    });

    await expect(compatRequest('/api/sales/token-1/orders')).rejects.toThrow('登录已过期，请重新登录');
    expect(removeStorageSpy).toHaveBeenCalledWith('sales_token');
    expect(redirectSpy).toHaveBeenCalledWith({ url: '/pages/login/login' });
  });

  it('rejects network failure with legacy message', async () => {
    const toastSpy = vi.fn();
    installMockWx({
      showToast: toastSpy,
      request: vi.fn(({ fail }: { fail?: (res: unknown) => void }) =>
        fail?.({
          errMsg: 'request:fail timeout',
        })
      ),
    });

    await expect(compatRequest('/api/sales/token-1/orders')).rejects.toThrow('网络请求失败');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: '网络请求失败' }));
  });
});
