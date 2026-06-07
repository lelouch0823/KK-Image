import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../useAuth';

describe('useAuth Composable Full Coverage', () => {
  const { isAuthenticated, currentUser, isLoading } = useAuth();

  beforeEach(() => {
    isAuthenticated.value = false;
    currentUser.value = null;
    isLoading.value = true;
    vi.restoreAllMocks();
    vi.stubGlobal('location', { pathname: '/some-page', href: '' });
  });

  it('checkAuth should handle AbortError', async () => {
    const err = new Error('Abort');
    err.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));

    const { checkAuth } = useAuth();
    const result = await checkAuth();
    expect(result).toBe(false);
    expect(isAuthenticated.value).toBe(false);
  });

  it('checkAuth should handle generic Error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Crash')));
    const { checkAuth } = useAuth();
    const result = await checkAuth();
    expect(result).toBe(false);
  });

  it('authFetch should handle 401 and reset state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({}),
      })
    );
    isAuthenticated.value = true;
    const { authFetch } = useAuth();
    await expect(authFetch('https://api.test')).rejects.toMatchObject({ status: 401 });
    expect(isAuthenticated.value).toBe(false);
  });

  it('authFetch should handle AbortError and rethrow', async () => {
    const err = new Error('Abort');
    err.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
    const { authFetch } = useAuth();
    await expect(authFetch('https://api.test')).rejects.toThrow('Abort');
  });

  it('logout should use new signal and handle catch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Logout fail')));
    const { logout } = useAuth();
    await logout();
    expect(isAuthenticated.value).toBe(false);
  });

  it('authFetch keeps credentials include and resets auth state on 401', async () => {
    vi.resetModules();
    const requestMock = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    vi.doMock('@/utils/http-core', () => ({ request: requestMock }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({}),
      })
    );

    const { useAuth: isolatedUseAuth } = await import('../useAuth');
    const auth = isolatedUseAuth();
    auth.isAuthenticated.value = true;
    auth.currentUser.value = { id: 1 };

    await expect(auth.authFetch('/api/protected', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/api/protected',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.currentUser.value).toBe(null);
  });
});
