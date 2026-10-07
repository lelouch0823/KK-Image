import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useNotifications } from '../useNotifications';

const mockAuthFetch = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

describe('useNotifications authz handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = useNotifications();
    store.stopPolling();
    store.setAdminMode();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks permission denied when notifications API returns 403', async () => {
    const forbiddenError = new Error('权限不足: notifications:read');
    forbiddenError.status = 403;
    forbiddenError.data = { error: '权限不足: notifications:read' };
    mockAuthFetch.mockRejectedValueOnce(forbiddenError);

    const store = useNotifications();
    await store.fetchNotifications();

    expect(store.permissionDenied.value).toBe(true);
    expect(store.permissionDeniedReason.value).toContain('权限不足');
  });

  it('clears permission denied after successful fetch', async () => {
    const store = useNotifications();
    store.permissionDenied.value = true;
    store.permissionDeniedReason.value = '权限不足';

    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: { list: [], unreadCount: 0 },
        }),
    });

    await store.fetchNotifications();

    expect(store.permissionDenied.value).toBe(false);
    expect(store.permissionDeniedReason.value).toBe('');
  });

  it('keeps the latest sales notification result when earlier token requests resolve late', async () => {
    let resolveFirst;
    let resolveSecond;
    mockAuthFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const store = useNotifications();
    store.setSalesMode('sales-token-a');
    const firstPending = store.fetchNotifications();

    store.setSalesMode('sales-token-b');
    const secondPending = store.fetchNotifications();

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            list: [{ id: 'n-b', is_read: 0 }],
            unreadCount: 1,
          },
        }),
    });
    await secondPending;

    expect(store.notifications.value).toEqual([{ id: 'n-b', is_read: 0 }]);
    expect(store.unreadCount.value).toBe(1);

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            list: [{ id: 'n-a', is_read: 0 }],
            unreadCount: 3,
          },
        }),
    });
    await firstPending;

    expect(store.notifications.value).toEqual([{ id: 'n-b', is_read: 0 }]);
    expect(store.unreadCount.value).toBe(1);
  });

  it('clears stale notification state when switching back to admin mode', async () => {
    const store = useNotifications();
    store.setSalesMode('sales-token');
    store.notifications.value = [{ id: 'sales-n-1', is_read: 0 }];
    store.unreadCount.value = 2;
    store.initialized.value = true;
    store.permissionDenied.value = true;
    store.permissionDeniedReason.value = '权限不足';

    store.setAdminMode();

    expect(store.notifications.value).toEqual([]);
    expect(store.unreadCount.value).toBe(0);
    expect(store.initialized.value).toBe(false);
    expect(store.permissionDenied.value).toBe(false);
    expect(store.permissionDeniedReason.value).toBe('');
  });

  it('keeps owner-started polling active when a transient consumer unmounts', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    mockAuthFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: { list: [], unreadCount: 0 },
        }),
    });

    const ownerScope = effectScope();
    let ownerStore;
    ownerScope.run(() => {
      ownerStore = useNotifications();
      ownerStore.startPolling(1000);
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    const transientScope = effectScope();
    transientScope.run(() => {
      useNotifications();
    });
    transientScope.stop();

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);

    ownerScope.stop();
  });

  it('lets a mode-switching owner replace and stop an existing poller', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    mockAuthFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: { list: [], unreadCount: 0 },
        }),
    });

    const adminScope = effectScope();
    adminScope.run(() => {
      const adminStore = useNotifications();
      adminStore.setAdminMode();
      adminStore.startPolling(1000);
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    const salesScope = effectScope();
    salesScope.run(() => {
      const salesStore = useNotifications();
      salesStore.setSalesMode('sales-token-a');
      salesStore.startPolling(1000);
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);

    salesScope.stop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);

    adminScope.stop();
  });

  it('backs off exponentially after failures and resets to the base interval on success', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('poll failed');
    mockAuthFetch
      .mockRejectedValueOnce(failure) // 初始请求失败
      .mockRejectedValueOnce(failure) // 退避到 2s 后的请求失败
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { list: [], unreadCount: 0 } }),
      }); // 退避到 4s 后的请求成功

    const scope = effectScope();
    scope.run(() => {
      const store = useNotifications();
      store.startPolling(1000);
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    // 第一次失败 → 下一轮退避到 2s：1s 处不应有请求
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // 累计 2s → 第二次请求（失败）
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);

    // 第二次失败 → 退避到 4s：累计 3s、5s 处都不应有请求
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3000); // 累计 6s → 第三次请求（成功）
    expect(mockAuthFetch).toHaveBeenCalledTimes(3);

    // 成功复位 → 下一轮回到基础间隔 1s
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockAuthFetch).toHaveBeenCalledTimes(4);

    scope.stop();
    consoleErrorSpy.mockRestore();
  });

  it('caps the backoff delay at 5 minutes', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthFetch.mockRejectedValue(new Error('poll failed'));

    const scope = effectScope();
    scope.run(() => {
      const store = useNotifications();
      store.startPolling(10000);
    });

    // 失败间隔：20s → 40s → 80s → 160s（第 4 次退避重试恰好落在 300s）
    await vi.advanceTimersByTimeAsync(300000);
    // 前 4 次退避重试应全部完成：初始 1 次 + 4 次
    expect(mockAuthFetch).toHaveBeenCalledTimes(5);

    // 第 5 次退避（320s 封顶为 300s）：299.999s 内不应触发
    await vi.advanceTimersByTimeAsync(299999);
    expect(mockAuthFetch).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockAuthFetch).toHaveBeenCalledTimes(6);

    scope.stop();
    consoleErrorSpy.mockRestore();
  });

  it('stops polling entirely when a poll hits a 403', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    const forbiddenError = new Error('权限不足');
    forbiddenError.status = 403;
    forbiddenError.data = { error: '权限不足' };
    mockAuthFetch.mockRejectedValue(forbiddenError);

    const scope = effectScope();
    let store;
    scope.run(() => {
      store = useNotifications();
      store.startPolling(1000);
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    // startPolling 为 fire-and-forget，先冲刷微任务等待 403 拒绝落定
    await vi.advanceTimersByTimeAsync(0);
    expect(store.permissionDenied.value).toBe(true);

    // 403 停止语义：后续不再排程任何轮询
    await vi.advanceTimersByTimeAsync(60000);
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    scope.stop();
  });

  it('skips fetching while the page is hidden and keeps the base cadence', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    mockAuthFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { list: [], unreadCount: 0 } }),
    });

    const scope = effectScope();
    scope.run(() => {
      const store = useNotifications();
      store.startPolling(1000);
    });
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    // 页面隐藏期间不发起请求
    expect(mockAuthFetch).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockAuthFetch).toHaveBeenCalledTimes(2);

    scope.stop();
  });
});
