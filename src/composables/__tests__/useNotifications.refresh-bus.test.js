import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.fn();
const publishRefresh = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('../useAppRefreshBus.js', () => ({
  useAppRefreshBus: () => ({ publishRefresh }),
}));

import { useNotifications } from '../useNotifications';

describe('useNotifications refresh bus integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = useNotifications();
    store.stopPolling();
    store.setAdminMode();
    store.unreadCount.value = 0;
  });

  it('publishes an orders refresh event when admin unread count increases', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            list: [{ id: 'n-1', is_read: 0 }],
            unreadCount: 2,
          },
        }),
    });

    const store = useNotifications();
    await store.fetchNotifications();

    expect(publishRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'orders',
        reason: 'notification',
      })
    );
  });
});
