import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainOutboxRepository } from '../DomainOutboxRepository.js';
import { getDomainEventDefinition } from '../../services/DomainEventCatalog.js';

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

describe('DomainOutboxRepository event catalog fan-out', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fans out only the consumers declared by the event catalog', () => {
    const db = createMockDb();
    const repo = new DomainOutboxRepository(db, {
      now: () => 1710000000000,
      uuid: vi.fn()
        .mockReturnValueOnce('job-audit-1')
        .mockReturnValueOnce('job-cache-1')
        .mockReturnValueOnce('job-notification-1')
        .mockReturnValueOnce('job-webhook-1')
        .mockReturnValueOnce('job-audit-2')
        .mockReturnValueOnce('job-cache-2'),
    });

    const statements = repo.buildInsertStatements(
      [
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
      ],
      (event) => getDomainEventDefinition(event.event_type).consumers
    );

    const jobStatements = statements.filter((statement) => statement.sql.includes('INSERT INTO outbox_consumer_jobs'));
    expect(jobStatements).toHaveLength(6);
    expect(jobStatements.map((statement) => statement.params[1])).toEqual([
      'audit',
      'cache',
      'notification',
      'webhook',
      'audit',
      'cache',
    ]);
  });
});
