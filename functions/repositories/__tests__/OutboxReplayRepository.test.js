import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxReplayRepository } from '../OutboxReplayRepository.js';

function createReplayDbStub({
  events = [],
  consumerJobsByEventId = {},
  webhookLogsByEventId = {},
  replayRuns = [],
} = {}) {
  const runs = replayRuns.map((row) => ({ ...row }));

  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...params) => ({
        all: vi.fn(async () => {
          if (sql.includes('FROM domain_outbox') && sql.includes('WHERE id = ?')) {
            const [eventId] = params;
            return {
              results: events.filter((row) => row.id === eventId),
            };
          }

          if (sql.includes('FROM domain_outbox') && sql.includes('WHERE command_id = ?')) {
            const [commandId] = params;
            return {
              results: events.filter((row) => row.command_id === commandId),
            };
          }

          if (sql.includes('FROM domain_outbox')) {
            return { results: events };
          }

          if (sql.includes('FROM outbox_consumer_jobs')) {
            const [eventId] = params;
            return {
              results: consumerJobsByEventId[eventId] || [],
            };
          }

          if (sql.includes('FROM webhook_logs')) {
            const [eventId] = params;
            return {
              results: webhookLogsByEventId[eventId] || [],
            };
          }

          return { results: [] };
        }),
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM outbox_replay_runs WHERE id = ?')) {
            const [runId] = params;
            return runs.find((row) => row.id === runId) || null;
          }

          return null;
        }),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO outbox_replay_runs')) {
            const [
              id,
              scopeType,
              scopeId,
              consumerName,
              dryRun,
              status,
              requestedBy,
              summaryJson,
              createdAt,
              updatedAt,
              completedAt,
            ] = params;

            runs.push({
              id,
              scope_type: scopeType,
              scope_id: scopeId,
              consumer_name: consumerName,
              dry_run: dryRun,
              status,
              requested_by: requestedBy,
              summary_json: summaryJson,
              created_at: createdAt,
              updated_at: updatedAt,
              completed_at: completedAt,
            });
          }

          if (sql.includes('UPDATE outbox_replay_runs')) {
            const [status, summaryJson, updatedAt, completedAt, runId] = params;
            const run = runs.find((row) => row.id === runId);
            if (run) {
              run.status = status;
              run.summary_json = summaryJson;
              run.updated_at = updatedAt;
              run.completed_at = completedAt;
            }
          }

          return { success: true, meta: { changes: 1 } };
        }),
      })),
    })),
  };
}

describe('OutboxReplayRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('queries events with consumer-job and webhook delivery state', async () => {
    const db = createReplayDbStub({
      events: [{
        id: 'evt-1',
        command_id: 'cmd-1',
        sequence_in_command: 1,
        event_type: 'purchase_receipt_recorded',
        event_version: 1,
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-1',
        payload_json: '{"purchase_order_id":"po-1"}',
        occurred_at: 1710000000000,
        created_at: 1710000000000,
      }],
      consumerJobsByEventId: {
        'evt-1': [{
          id: 'job-1',
          consumer_name: 'notification',
          status: 'published',
          attempt_count: 0,
          available_at: 1710000000000,
        }],
      },
      webhookLogsByEventId: {
        'evt-1': [{
          id: 'whlog-1',
          webhook_id: 'wh-1',
          delivery_key: 'evt-1:wh-1:v1',
          classification: 'delivered',
          success: 1,
          attempt_number: 1,
        }],
      },
    });
    const repo = new OutboxReplayRepository(db, {
      now: () => 1710000011111,
      idFactory: () => 'replay-1',
    });

    const list = await repo.listEvents({ eventType: 'purchase_receipt_recorded' });
    const detail = await repo.getEventDetail('evt-1');

    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(expect.objectContaining({
      id: 'evt-1',
      consumerJobs: [expect.objectContaining({ consumer_name: 'notification' })],
      webhookAttempts: [expect.objectContaining({ delivery_key: 'evt-1:wh-1:v1' })],
    }));
    expect(detail).toEqual(expect.objectContaining({
      id: 'evt-1',
      consumerJobs: [expect.objectContaining({ id: 'job-1' })],
      webhookAttempts: [expect.objectContaining({ id: 'whlog-1' })],
    }));
  });

  it('creates replay runs for dry-run and live replay requests', async () => {
    const db = createReplayDbStub();
    const repo = new OutboxReplayRepository(db, {
      now: () => 1710000011111,
      idFactory: vi.fn()
        .mockReturnValueOnce('replay-1')
        .mockReturnValueOnce('replay-2'),
    });

    const dryRun = await repo.createReplayRun({
      scopeType: 'event',
      scopeId: 'evt-1',
      consumerName: 'notification',
      dryRun: true,
      requestedBy: 'admin-1',
    });
    const liveRun = await repo.createReplayRun({
      scopeType: 'command',
      scopeId: 'cmd-1',
      consumerName: 'webhook',
      dryRun: false,
      requestedBy: 'admin-1',
    });

    expect(dryRun).toEqual(expect.objectContaining({
      id: 'replay-1',
      scope_type: 'event',
      scope_id: 'evt-1',
      consumer_name: 'notification',
      dry_run: 1,
      status: 'pending',
    }));
    expect(liveRun).toEqual(expect.objectContaining({
      id: 'replay-2',
      scope_type: 'command',
      scope_id: 'cmd-1',
      consumer_name: 'webhook',
      dry_run: 0,
      status: 'pending',
    }));
  });

  it('finds all events emitted by a command_id or a specific event_id', async () => {
    const db = createReplayDbStub({
      events: [
        {
          id: 'evt-1',
          command_id: 'cmd-1',
          sequence_in_command: 1,
          event_type: 'purchase_receipt_recorded',
          event_version: 1,
          aggregate_type: 'purchase_receipt',
          aggregate_id: 'receipt-1',
          payload_json: '{}',
          occurred_at: 1710000000000,
          created_at: 1710000000000,
        },
        {
          id: 'evt-2',
          command_id: 'cmd-1',
          sequence_in_command: 2,
          event_type: 'order_procurement_progressed',
          event_version: 1,
          aggregate_type: 'order',
          aggregate_id: 'o-1',
          payload_json: '{}',
          occurred_at: 1710000000001,
          created_at: 1710000000001,
        },
      ],
    });
    const repo = new OutboxReplayRepository(db, {
      now: () => 1710000011111,
      idFactory: () => 'replay-1',
    });

    const byCommand = await repo.findEventsByScope({ scopeType: 'command', scopeId: 'cmd-1' });
    const byEvent = await repo.findEventsByScope({ scopeType: 'event', scopeId: 'evt-2' });

    expect(byCommand.map((event) => event.id)).toEqual(['evt-1', 'evt-2']);
    expect(byEvent.map((event) => event.id)).toEqual(['evt-2']);
  });
});
