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

  it('rolls back previously inserted outbox events when a later publish chunk fails', async () => {
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
        if (batchCalls.length === 2) {
          throw new Error('second chunk failed');
        }
        return statements.map(() => ({ meta: { changes: 1 } }));
      }),
    };
    const publisher = new DomainOutboxPublisher(db, {
      uuid,
      now: () => 1710000000000,
    });

    const events = Array.from({ length: 60 }, (_, index) => ({
      event_type: 'purchase_order_created',
      aggregate_type: 'purchase_order',
      aggregate_id: `po-${index + 1}`,
      payload: {
        purchase_order_id: `po-${index + 1}`,
      },
    }));

    await expect(publisher.publish(events)).rejects.toThrow('second chunk failed');

    expect(db.batch).toHaveBeenCalledTimes(3);
    const rollbackStatements = batchCalls[2];
    expect(rollbackStatements).toHaveLength(50);
    expect(rollbackStatements.every((statement) => statement.sql.includes('DELETE FROM domain_outbox'))).toBe(true);
    expect(rollbackStatements[0].params).toEqual(['uuid-2']);
    expect(rollbackStatements[49].params).toEqual(['uuid-51']);
  });
});
