import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationRepository } from '../NotificationRepository.js';

function createNotificationDbStub() {
  const notifications = [];
  let nextId = 1;

  function createStatement(sql) {
    const normalizedSql = String(sql || '');
    const statement = {
      sql: normalizedSql,
      params: [],
      bind: vi.fn((...params) => {
        statement.params = params;
        return statement;
      }),
      first: vi.fn(async () => {
        if (!normalizedSql.includes('FROM notifications')) {
          return null;
        }

        const [sourceConsumer, dedupeKey, receiver, salespersonScope] = statement.params;
        return notifications.find((notification) => (
          notification.source_consumer === sourceConsumer
          && notification.dedupe_key === dedupeKey
          && notification.receiver === receiver
          && (notification.salesperson_id || '') === salespersonScope
        )) || null;
      }),
      run: vi.fn(async () => {
        if (!normalizedSql.includes('INSERT INTO notifications')) {
          return { success: true, meta: { changes: 1 } };
        }

        const [
          id,
          type,
          title,
          content,
          link,
          receiver,
          salespersonId,
          orderId,
          metadataJson,
          sourceConsumer,
          sourceEventId,
          dedupeKey,
          createdAt,
        ] = statement.params;

        const existing = notifications.find((notification) => (
          notification.source_consumer === sourceConsumer
          && notification.dedupe_key === dedupeKey
          && notification.receiver === receiver
          && (notification.salesperson_id || '') === (salespersonId || '')
        ));

        if (existing) {
          return { success: true, meta: { changes: 0 } };
        }

        notifications.push({
          id: id || `notification-${nextId++}`,
          type,
          title,
          content,
          link,
          is_read: 0,
          receiver,
          salesperson_id: salespersonId,
          order_id: orderId,
          metadata: metadataJson,
          source_consumer: sourceConsumer,
          source_event_id: sourceEventId,
          dedupe_key: dedupeKey,
          created_at: createdAt,
        });

        return { success: true, meta: { changes: 1 } };
      }),
    };

    return statement;
  }

  return {
    notifications,
    prepare: vi.fn((sql) => createStatement(sql)),
  };
}

describe('NotificationRepository domain outbox dedupe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates one notification for a unique source consumer + dedupe key', async () => {
    const db = createNotificationDbStub();
    const repo = new NotificationRepository(db);

    const result = await repo.createFromDomainEvent({
      type: 'order',
      title: '{"key":"notification.purchase_receipt_recorded"}',
      content: '{"count":1}',
      link: '/manage/purchase-orders/po-1',
      receiver: 'admin',
      orderId: 'po-1',
      metadata: { eventType: 'purchase_receipt_recorded' },
      sourceConsumer: 'notification',
      sourceEventId: 'evt-1',
      dedupeKey: 'purchase_receipt_recorded:evt-1:admin',
    });

    expect(result).toEqual({
      id: expect.any(String),
      created: true,
    });
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]).toEqual(expect.objectContaining({
      receiver: 'admin',
      order_id: 'po-1',
      source_consumer: 'notification',
      source_event_id: 'evt-1',
      dedupe_key: 'purchase_receipt_recorded:evt-1:admin',
    }));
  });

  it('returns the existing notification when the same event is replayed', async () => {
    const db = createNotificationDbStub();
    const repo = new NotificationRepository(db);

    const first = await repo.createFromDomainEvent({
      type: 'order',
      title: '{"key":"notification.order_procurement_progressed"}',
      receiver: 'admin',
      orderId: 'po-1',
      metadata: { eventType: 'order_procurement_progressed' },
      sourceConsumer: 'notification',
      sourceEventId: 'evt-2',
      dedupeKey: 'order_procurement_progressed:evt-2:admin',
    });

    const replay = await repo.createFromDomainEvent({
      type: 'order',
      title: '{"key":"notification.order_procurement_progressed"}',
      receiver: 'admin',
      orderId: 'po-1',
      metadata: { eventType: 'order_procurement_progressed' },
      sourceConsumer: 'notification',
      sourceEventId: 'evt-2',
      dedupeKey: 'order_procurement_progressed:evt-2:admin',
    });

    expect(first.created).toBe(true);
    expect(replay).toEqual({
      id: first.id,
      created: false,
    });
    expect(db.notifications).toHaveLength(1);
  });
});
