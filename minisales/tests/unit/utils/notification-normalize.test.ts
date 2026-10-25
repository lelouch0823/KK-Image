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

  it('renders backend i18n descriptors into readable Chinese text (C-R4)', () => {
    const notification = normalizeSalesNotification({
      id: 'n-i18n',
      type: 'order',
      title: '{"key":"notification.orderAssigned","params":{"orderNo":""}}',
      content: 'notification.reminder.deadline_desc',
      is_read: 0,
      created_at: 1,
    });

    expect(notification.title).toBe('您有新的指派订单');
    expect(notification.content).toBe('订单 {orderNo} 期望交货日期为 {deadline}，请关注进度。');
  });

  it('passes through non-descriptor text unchanged', () => {
    const notification = normalizeSalesNotification({
      id: 'n-plain',
      title: '订单有更新',
      content: '',
      is_read: 1,
      created_at: 1,
    });

    expect(notification.title).toBe('订单有更新');
    expect(notification.content).toBe('');
  });

  it('interpolates params from the descriptor', () => {
    const notification = normalizeSalesNotification({
      id: 'n-params',
      title: JSON.stringify({ key: 'notification.order.updatedDesc', params: { actor: '管理员', orderNo: 'SO-9' } }),
      is_read: 1,
      created_at: 1,
    });

    expect(notification.title).toBe('管理员 修改了订单 SO-9');
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
