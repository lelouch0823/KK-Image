import { describe, expect, it } from 'vitest';
import {
  normalizeSalesNotification,
  normalizeSalesNotificationsPayload,
} from '../../../miniprogram/utils/normalize/notification';

describe('notification normalizers', () => {
  it('normalizes a single sales notification into a stable shape', () => {
    const notification = normalizeSalesNotification({
      id: 'n-1',
      type: 'order',
      title: '{"key":"notification.order.updated"}',
      content: '订单有更新',
      link: '/sales/token/detail/o-1',
      is_read: 0,
      orderId: 'o-1',
      metadata: { reason: 'progress' },
      created_at: 100,
    });

    expect(notification).toEqual(
      expect.objectContaining({
        id: 'n-1',
        isRead: false,
        unread: true,
        orderId: 'o-1',
        link: '/sales/token/detail/o-1',
        metadata: { reason: 'progress' },
      })
    );
  });

  it('normalizes list payloads and preserves unread counts', () => {
    const payload = normalizeSalesNotificationsPayload({
      list: [
        { id: 'n-1', is_read: 0 },
        { id: 'n-2', is_read: 1 },
      ],
      unreadCount: 1,
    });

    expect(payload.unreadCount).toBe(1);
    expect(payload.list).toEqual([
      expect.objectContaining({ id: 'n-1', unread: true }),
      expect.objectContaining({ id: 'n-2', unread: false }),
    ]);
  });

  it('parses metadata when backend returns a JSON string payload', () => {
    const notification = normalizeSalesNotification({
      id: 'n-1',
      is_read: 0,
      metadata: '{"reason":"progress","source":"order"}',
    });

    expect(notification.metadata).toEqual({
      reason: 'progress',
      source: 'order',
    });
  });
});
