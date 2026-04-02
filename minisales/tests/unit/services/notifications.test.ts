import { describe, expect, it, vi } from 'vitest';
import {
  list,
  markAllRead,
  markRead,
} from '../../../miniprogram/services/sales/notifications';

describe('sales notifications service', () => {
  it('provides spec-named list/read helpers on top of current sales routes', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        data: { list: [{ id: 'n-1', is_read: 0 }], unreadCount: 1 },
        error: null,
        code: null,
        status: 200,
        detail: null,
        payload: { success: true },
      })
      .mockResolvedValueOnce({
        success: true,
        data: null,
        error: null,
        code: null,
        status: 200,
        detail: null,
        payload: { success: true },
      })
      .mockResolvedValueOnce({
        success: true,
        data: null,
        error: null,
        code: null,
        status: 200,
        detail: null,
        payload: { success: true },
      });

    const result = await list({ accessToken: 'sales-token', limit: 20 }, request);
    await markRead({ accessToken: 'sales-token', notificationId: 'n-1' }, request);
    await markAllRead({ accessToken: 'sales-token' }, request);

    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/sales/sales-token/notifications?limit=20',
        method: 'GET',
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/api/sales/sales-token/notifications/n-1/read',
        method: 'POST',
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        path: '/api/sales/sales-token/notifications/all/read',
        method: 'POST',
      })
    );
    expect(result.data).toEqual({
      list: [expect.objectContaining({ id: 'n-1', unread: true })],
      unreadCount: 1,
    });
  });
});
