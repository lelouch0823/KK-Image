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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
    isAuthenticated.value = true;
    const { authFetch } = useAuth();
    await authFetch('https://api.test');
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
});
