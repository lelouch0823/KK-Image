import { describe, expect, it, vi } from 'vitest';

import { DomainOutboxPublisher } from '../DomainOutboxPublisher.js';

describe('DomainOutboxPublisher', () => {
  it('chunks large outbox publish batches into D1-safe sizes', async () => {
    const batchCalls = [];
    const uuid = vi.fn();
    let sequence = 0;
    uuid.mockImplementation(() => `uuid-${++sequence}`);

    const db = {
      prepare: vi.fn((sql) => {
        const statement = {
          sql,
          bind: vi.fn((...params) => {
            statement.params = params;
            return statement;
          }),
        };
        return statement;
      }),
      batch: vi.fn(async (statements = []) => {
        batchCalls.push(statements);
        return statements.map(() => ({ meta: { changes: 1 } }));
      }),
    };
    const publisher = new DomainOutboxPublisher(db, {
      uuid,
      now: () => 1710000000000,
    });

    const events = Array.from({ length: 205 }, (_, index) => ({
      event_type: 'purchase_order_status_changed',
      aggregate_type: 'purchase_order',
      aggregate_id: `po-${index + 1}`,
      payload: {
        purchase_order_id: `po-${index + 1}`,
        status: 'ordered',
      },
    }));

    const published = await publisher.publish(events);

    expect(published).toHaveLength(205);
    expect(db.batch).toHaveBeenCalledTimes(5);
    expect(Math.max(...batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
  });
});
