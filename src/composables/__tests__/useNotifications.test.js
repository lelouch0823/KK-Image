import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
