import { describe, expect, it, vi } from 'vitest';
import {
  handleMissingAccessToken,
  handleSalesSessionExpired,
  restoreSalesSession,
} from '../../../miniprogram/services/auth/session';

describe('restoreSalesSession', () => {
  it('hydrates user state when access token and JWT are valid', async () => {
    const getCurrentUser = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });

    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser,
    });

    expect(result).toMatchObject({
      ok: true,
      user: { id: 'sp-1', name: 'Alice', store: 'Shanghai' },
    });
  });

  it('clears stale session data when auth check fails', async () => {
    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser: vi.fn().mockResolvedValue({
        success: false,
        error: 'expired',
        isAuthInvalid: true,
      }),
    });

    expect(result).toEqual({ ok: false, reason: 'expired', expired: true });
  });

  it('keeps session state when restore fails due to transient errors', async () => {
    const removeStorageSync = vi.fn();
    (globalThis as any).wx = {
      removeStorageSync,
      setStorageSync: vi.fn(),
      reLaunch: vi.fn(),
    };

    const result = await restoreSalesSession({
      accessToken: 'sales-token',
      getCurrentUser: vi.fn().mockResolvedValue({
        success: false,
        error: 'network_error',
        isAuthInvalid: false,
      }),
    });

    expect(result).toEqual({ ok: false, reason: 'network_error', expired: false });
    expect(removeStorageSync).not.toHaveBeenCalled();
  });
});

describe('session clear primitives', () => {
  it('clears JWT/user state and redirects without clearing access token when session expires', () => {
    const removeStorageSync = vi.fn();
    const reLaunch = vi.fn();
    const setStorageSync = vi.fn();
    (globalThis as any).wx = {
      removeStorageSync,
      reLaunch,
      setStorageSync,
    };

    handleSalesSessionExpired();

    expect(removeStorageSync).toHaveBeenCalledWith('sales_token');
    expect(removeStorageSync).toHaveBeenCalledWith('user_info');
    expect(removeStorageSync).toHaveBeenCalledWith('sales_login_method');
    expect(removeStorageSync).not.toHaveBeenCalledWith('access_token');
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/login/login' });
  });

  it('clears access token too when access token is missing or stale', () => {
    const removeStorageSync = vi.fn();
    const reLaunch = vi.fn();
    const setStorageSync = vi.fn();
    (globalThis as any).wx = {
      removeStorageSync,
      reLaunch,
      setStorageSync,
    };

    handleMissingAccessToken();

    expect(removeStorageSync).toHaveBeenCalledWith('access_token');
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/login/login' });
  });
});
