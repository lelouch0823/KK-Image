import { describe, expect, it, vi } from 'vitest';
import { installMockWx } from '../../setup/wx';
import { fetchCurrentSalesUser, wxLogin } from '../../../miniprogram/utils/auth';

describe('auth contract', () => {
  it('fetchCurrentSalesUser requests GET /api/sales/:token/auth', async () => {
    const requestSpy = vi.fn(({ success }: { success?: (res: unknown) => void }) =>
      success?.({
        statusCode: 200,
        data: {
          success: true,
          data: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
        },
      })
    );

    installMockWx({
      request: requestSpy,
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
      showToast: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
    } as any);

    const result = await fetchCurrentSalesUser('sales-token');

    expect(result).toEqual({
      success: true,
      data: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: expect.stringContaining('/api/sales/sales-token/auth'),
      })
    );
  });

  it('wxLogin succeeds with backend wechat payload when access token already exists', async () => {
    const setStorageSync = vi.fn();
    const requestSpy = vi.fn(({ success }: { success?: (res: unknown) => void }) =>
      success?.({
        statusCode: 200,
        data: {
          success: true,
          data: {
            token: 'jwt-1',
            user: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
            expiresIn: 7200,
          },
        },
      })
    );

    installMockWx({
      request: requestSpy,
      setStorageSync,
      removeStorageSync: vi.fn(),
      getStorageSync: vi.fn((key: string) => (key === 'access_token' ? 'sales-link-token' : '')),
      showToast: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
    } as any);
    (globalThis as any).wx.login = vi.fn(({ success }: { success?: (res: unknown) => void }) =>
      success?.({ code: 'wx-code-1' })
    );

    const result = await wxLogin();

    expect(result).toMatchObject({
      success: true,
      user: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });
    expect(setStorageSync).toHaveBeenCalledWith('sales_token', 'jwt-1');
    expect(setStorageSync).toHaveBeenCalledWith('access_token', 'sales-link-token');
  });

  it('wxLogin fails clearly when no usable access token is available', async () => {
    const setStorageSync = vi.fn();
    installMockWx({
      request: vi.fn(({ success }: { success?: (res: unknown) => void }) =>
        success?.({
          statusCode: 200,
          data: {
            success: true,
            data: {
              token: 'jwt-1',
              user: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
              expiresIn: 7200,
            },
          },
        })
      ),
      setStorageSync,
      removeStorageSync: vi.fn(),
      getStorageSync: vi.fn(() => ''),
      showToast: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
    } as any);
    (globalThis as any).wx.login = vi.fn(({ success }: { success?: (res: unknown) => void }) =>
      success?.({ code: 'wx-code-1' })
    );

    const result = await wxLogin();

    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少访问凭证');
    expect(setStorageSync).not.toHaveBeenCalledWith('sales_token', 'jwt-1');
  });
});
