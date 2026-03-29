import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainOutboxRepository } from '../DomainOutboxRepository.js';

function createPreparedStatement(sql) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
  };
  return statement;
}

function createMockDb() {
  return {
    prepare: vi.fn((sql) => createPreparedStatement(sql)),
  };
}

describe('DomainOutboxRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('appends outbox events and fan-out consumer jobs in one call', () => {
    const db = createMockDb();
    const repo = new DomainOutboxRepository(db, {
      now: () => 1710000000000,
      uuid: vi.fn()
        .mockReturnValueOnce('job-audit-1')
        .mockReturnValueOnce('job-cache-1')
        .mockReturnValueOnce('job-audit-2')
        .mockReturnValueOnce('job-cache-2'),
    });

    const statements = repo.buildInsertStatements([
      {
        id: 'evt-1',
        command_id: 'cmd-1',
        sequence_in_command: 1,
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-1',
        correlation_id: 'cmd-1',
        causation_id: 'cmd-1',
        idempotency_key: 'cmd-1:poi-1:purchase_receipt_recorded',
        payload_json: '{"receipt_id":"receipt-1"}',
        occurred_at: 1700000000000,
      },
      {
        id: 'evt-2',
        command_id: 'cmd-1',
        sequence_in_command: 2,
        event_type: 'inventory_received',
        aggregate_type: 'inventory_event',
        aggregate_id: 'inventory-event-1',
        correlation_id: 'cmd-1',
        causation_id: 'cmd-1',
        idempotency_key: 'cmd-1:inventory-event-1:inventory_received',
        payload_json: '{"inventory_event_id":"inventory-event-1"}',
        occurred_at: 1700000000001,
      },
    ], ['audit', 'cache']);

    expect(statements).toHaveLength(6);

    const eventStatements = statements.filter((statement) => statement.sql.includes('INSERT INTO domain_outbox'));
    expect(eventStatements).toHaveLength(2);
    expect(eventStatements[0].params).toEqual([
      'evt-1',
      'cmd-1',
      1,
      'purchase_receipt_recorded',
      1,
      'purchase_receipt',
      'receipt-1',
      'cmd-1',
      'cmd-1',
      'cmd-1:poi-1:purchase_receipt_recorded',
      '{"receipt_id":"receipt-1"}',
      1700000000000,
      1710000000000,
    ]);

    const jobStatements = statements.filter((statement) => statement.sql.includes('INSERT INTO outbox_consumer_jobs'));
    expect(jobStatements).toHaveLength(4);
    expect(jobStatements[0].params).toEqual([
      'job-audit-1',
      'audit',
      'evt-1',
      'pending',
      0,
      1710000000000,
      null,
      null,
      null,
      null,
      1710000000000,
      1710000000000,
    ]);
    expect(jobStatements[3].params[1]).toBe('cache');
    expect(jobStatements[3].params[2]).toBe('evt-2');
  });
});
