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

  it('checkAuth resolves and resets isLoading when the request hangs until timeout', async () => {
    vi.useFakeTimers();
    // 模拟一个永不 resolve 的请求，仅在 abort signal 触发时 reject
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options = {}) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          })
      )
    );

    const { checkAuth } = useAuth();
    const pending = checkAuth();
    expect(isLoading.value).toBe(true);

    // http-core 默认 30s 超时触发中止，守卫不再被永久阻塞
    await vi.advanceTimersByTimeAsync(30000);
    await expect(pending).resolves.toBe(false);
    expect(isLoading.value).toBe(false);
    expect(isAuthenticated.value).toBe(false);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('checkAuth treats a non-2xx response as unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({}),
      })
    );
    isAuthenticated.value = true;
    const { checkAuth } = useAuth();
    await expect(checkAuth()).resolves.toBe(false);
    expect(isAuthenticated.value).toBe(false);
    expect(currentUser.value).toBe(null);
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

  it('authFetch merges caller and logout abort signals while preserving timeout options', async () => {
    vi.resetModules();
    let capturedOptions;
    const requestMock = vi.fn((_url, options) => {
      capturedOptions = options;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('Abort');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.doMock('@/utils/http-core', () => ({ request: requestMock }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })
    );

    const { useAuth: isolatedUseAuth } = await import('../useAuth');
    const auth = isolatedUseAuth();
    const caller = new AbortController();
    const pending = auth.authFetch('/api/protected', {
      signal: caller.signal,
      timeout: 123,
    });

    await Promise.resolve();

    expect(capturedOptions.timeout).toBe(123);
    expect(capturedOptions.signal).not.toBe(caller.signal);
    expect(capturedOptions.signal.aborted).toBe(false);

    await auth.logout();

    expect(capturedOptions.signal.aborted).toBe(true);
    await expect(pending).rejects.toThrow('Abort');
  });
});
