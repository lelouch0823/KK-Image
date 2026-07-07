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
});
