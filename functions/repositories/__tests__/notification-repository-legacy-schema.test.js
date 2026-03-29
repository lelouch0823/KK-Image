import { describe, it, expect } from 'vitest';
import { NotificationRepository } from '../NotificationRepository.js';

function createLegacySchemaDbStub() {
  const calls = [];

  function noSuchColumn(column) {
    const err = new Error(`no such column: ${column}`);
    err.code = 'SQLITE_ERROR';
    return err;
  }

  function createStatement(sql) {
    const normalizedSql = String(sql || '');

    return {
      bind(..._params) {
        return {
          async all() {
            if (normalizedSql.includes("WHERE receiver = 'admin'")) {
              throw noSuchColumn('receiver');
            }
            if (normalizedSql.includes("WHERE receiver = 'sales'")) {
              throw noSuchColumn('receiver');
            }
            return {
              results: [
                {
                  id: 'n-1',
                  type: 'order',
                  title: '{"key":"notification.order.updated"}',
                  content: '{}',
                  link: '/admin/orders?id=o-1',
                  is_read: 0,
                  metadata: '{}',
                  created_at: 1730000000000,
                },
              ],
            };
          },
          async first() {
            if (normalizedSql.includes("WHERE receiver = 'admin'")) {
              throw noSuchColumn('receiver');
            }
            if (normalizedSql.includes("WHERE receiver = 'sales'")) {
              throw noSuchColumn('receiver');
            }
            if (normalizedSql.includes('source_consumer') || normalizedSql.includes('dedupe_key')) {
              throw noSuchColumn('source_consumer');
            }
            return { count: 1 };
          },
          async run() {
            if (
              normalizedSql.includes('INSERT INTO notifications') &&
              (
                normalizedSql.includes('salesperson_id')
                || normalizedSql.includes('source_consumer')
                || normalizedSql.includes('source_event_id')
                || normalizedSql.includes('dedupe_key')
              )
            ) {
              throw noSuchColumn(
                normalizedSql.includes('source_consumer') ? 'source_consumer' : 'salesperson_id'
              );
            }
            return { success: true };
          },
        };
      },
      async all() {
        return this.bind().all();
      },
      async first() {
        return this.bind().first();
      },
      async run() {
        return this.bind().run();
      },
    };
  }

  return {
    calls,
    prepare(sql) {
      calls.push(String(sql || ''));
      return createStatement(sql);
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
      return { success: true };
    },
  };
}

describe('NotificationRepository legacy schema compatibility', () => {
  it('falls back to legacy query when receiver column is missing for admin list', async () => {
    const db = createLegacySchemaDbStub();
    const repo = new NotificationRepository(db);

    const result = await repo.listForAdmin({ unreadOnly: true, limit: 20 });

    expect(result.unreadCount).toBe(1);
    expect(result.list).toHaveLength(1);
    expect(result.list[0].id).toBe('n-1');
  });

  it('falls back to legacy insert when salesperson_id/order_id columns are missing', async () => {
    const db = createLegacySchemaDbStub();
    const repo = new NotificationRepository(db);

    const result = await repo.create({
      type: 'order',
      title: '{"key":"notification.order.updated"}',
      content: '{}',
      link: '/orders/o-1',
      receiver: 'sales',
      salespersonId: 'sp-1',
      orderId: 'o-1',
      metadata: { event: 'ORDER_STATUS_CHANGED' },
    });

    expect(result).toHaveProperty('id');
    expect(db.calls.some((sql) => sql.includes('salesperson_id'))).toBe(true);
    expect(
      db.calls.some(
        (sql) =>
          sql.includes('INSERT INTO notifications') &&
          !sql.includes('salesperson_id') &&
          !sql.includes('order_id')
      )
    ).toBe(true);
  });

  it('returns empty sales list on legacy schema instead of throwing', async () => {
    const db = createLegacySchemaDbStub();
    const repo = new NotificationRepository(db);

    const result = await repo.listForSalesperson('sp-1', { unreadOnly: true, limit: 20 });

    expect(result).toEqual({ list: [], unreadCount: 0 });
  });

  it('falls back safely on legacy schemas without source columns', async () => {
    const db = createLegacySchemaDbStub();
    const repo = new NotificationRepository(db);

    const result = await repo.createFromDomainEvent({
      type: 'order',
      title: '{"key":"notification.purchase_receipt_recorded"}',
      receiver: 'admin',
      orderId: 'o-1',
      metadata: { eventType: 'purchase_receipt_recorded' },
      sourceConsumer: 'notification',
      sourceEventId: 'evt-1',
      dedupeKey: 'purchase_receipt_recorded:evt-1:admin',
    });

    expect(result).toEqual({
      id: expect.any(String),
      created: true,
    });
    expect(db.calls.some((sql) => sql.includes('source_consumer'))).toBe(true);
    expect(
      db.calls.some(
        (sql) =>
          sql.includes('INSERT INTO notifications')
          && !sql.includes('source_consumer')
          && !sql.includes('source_event_id')
          && !sql.includes('dedupe_key')
      )
    ).toBe(true);
  });
});
