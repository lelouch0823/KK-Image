import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxReplayRepository } from '../OutboxReplayRepository.js';

function createReplayDbStub({
  events = [],
  consumerJobsByEventId = {},
  webhookLogsByEventId = {},
  replayRuns = [],
} = {}) {
  const runs = replayRuns.map((row) => ({ ...row }));
  const prepareCalls = [];

  const db = {
    prepare: vi.fn((sql) => {
      prepareCalls.push(sql);
      return {
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
              let filtered = [...events];

              if (sql.includes('event_type = ?')) {
                const eventType = params.find((value) => events.some((row) => row.event_type === value));
                if (eventType) {
                  filtered = filtered.filter((row) => row.event_type === eventType);
                }
              }

              if (sql.includes('FROM outbox_consumer_jobs jobs')) {
                const hasConsumerNameFilter = sql.includes('jobs.consumer_name = ?');
                const hasStatusFilter = sql.includes('jobs.status = ?');
                const filterBindings = params.slice(
                  params.length - Number(hasConsumerNameFilter) - Number(hasStatusFilter)
                );
                let bindingIndex = 0;
                const consumerName = hasConsumerNameFilter ? filterBindings[bindingIndex++] : null;
                const status = hasStatusFilter ? filterBindings[bindingIndex++] : null;

                filtered = filtered.filter((row) => {
                  const jobs = consumerJobsByEventId[row.id] || [];
                  return jobs.some((job) => {
                    if (consumerName && job.consumer_name !== consumerName) return false;
                    if (status && job.status !== status) return false;
                    return true;
                  });
                });
              }

              return { results: filtered };
            }

            if (sql.includes('FROM outbox_consumer_jobs')) {
              const eventIds = params.filter((value) => typeof value === 'string' && value in consumerJobsByEventId);
              const filterBindings = params.slice(eventIds.length);
              let bindingIndex = 0;
              const consumerName = sql.includes('consumer_name = ?')
                ? filterBindings[bindingIndex++]
                : null;
              const status = sql.includes('status = ?') ? filterBindings[bindingIndex++] : null;
              const targetEventIds = eventIds.length ? eventIds : [params[0]];
              const rows = targetEventIds.flatMap((eventId) => consumerJobsByEventId[eventId] || []);

              return {
                results: rows.filter((job) => {
                  if (consumerName && job.consumer_name !== consumerName) return false;
                  if (status && job.status !== status) return false;
                  return true;
                }),
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
      };
    }),
  };

  db.getPrepareCalls = () => [...prepareCalls];
  return db;
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
          event_id: 'evt-1',
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
    }));
    expect(detail).toEqual(expect.objectContaining({
      id: 'evt-1',
      consumerJobs: [expect.objectContaining({ id: 'job-1' })],
      webhookAttempts: [expect.objectContaining({ id: 'whlog-1' })],
    }));
  });

  it('filters event list by consumer status without fetching webhook detail per row', async () => {
    const db = createReplayDbStub({
      events: [
        {
          id: 'evt-1',
          command_id: 'cmd-1',
          sequence_in_command: 1,
          event_type: 'purchase_receipt_recorded',
          aggregate_id: 'receipt-1',
          created_at: 1710000000000,
        },
        {
          id: 'evt-2',
          command_id: 'cmd-2',
          sequence_in_command: 1,
          event_type: 'purchase_receipt_recorded',
          aggregate_id: 'receipt-2',
          created_at: 1710000001000,
        },
        {
          id: 'evt-3',
          command_id: 'cmd-3',
          sequence_in_command: 1,
          event_type: 'purchase_receipt_recorded',
          aggregate_id: 'receipt-3',
          created_at: 1710000001500,
        },
        {
          id: 'evt-4',
          command_id: 'cmd-4',
          sequence_in_command: 1,
          event_type: 'order_created_by_admin',
          aggregate_id: 'order-1',
          created_at: 1710000002000,
        },
      ],
      consumerJobsByEventId: {
        'evt-1': [
          { id: 'job-1', event_id: 'evt-1', consumer_name: 'notification', status: 'failed' },
          { id: 'job-2', event_id: 'evt-1', consumer_name: 'cache', status: 'published' },
        ],
        'evt-2': [
          { id: 'job-3', event_id: 'evt-2', consumer_name: 'notification', status: 'failed' },
        ],
        'evt-3': [
          { id: 'job-4', event_id: 'evt-3', consumer_name: 'notification', status: 'published' },
        ],
        'evt-4': [
          { id: 'job-5', event_id: 'evt-4', consumer_name: 'notification', status: 'published' },
        ],
      },
      webhookLogsByEventId: {
        'evt-1': [{ id: 'whlog-1', event_id: 'evt-1' }],
        'evt-2': [{ id: 'whlog-2', event_id: 'evt-2' }],
      },
    });
    const repo = new OutboxReplayRepository(db);

    const list = await repo.listEvents({
      eventType: 'purchase_receipt_recorded',
      consumerName: 'notification',
      status: 'failed',
    });

    expect(list.map((item) => item.id)).toEqual(['evt-1', 'evt-2']);
    expect(list[0].consumerJobs).toEqual([
      expect.objectContaining({ consumer_name: 'notification', status: 'failed' }),
    ]);
    expect(db.getPrepareCalls().filter((sql) => sql.includes('FROM webhook_logs'))).toHaveLength(0);
    expect(
      db.getPrepareCalls().filter(
        (sql) => sql.includes('FROM outbox_consumer_jobs') && !sql.includes('FROM domain_outbox')
      )
    ).toHaveLength(1);
  });

  it('batches consumer job lookups when the event list is larger than one SQL variable window', async () => {
    const events = Array.from({ length: 95 }, (_, index) => ({
      id: `evt-${index + 1}`,
      command_id: `cmd-${index + 1}`,
      sequence_in_command: 1,
      event_type: 'purchase_receipt_recorded',
      aggregate_id: `receipt-${index + 1}`,
      created_at: 1710000000000 + index,
    }));
    const consumerJobsByEventId = Object.fromEntries(
      events.map((event) => [
        event.id,
        [{
          id: `job-${event.id}`,
          event_id: event.id,
          consumer_name: 'notification',
          status: 'published',
        }],
      ])
    );
    const db = createReplayDbStub({ events, consumerJobsByEventId });
    const repo = new OutboxReplayRepository(db);

    const list = await repo.listEvents({ eventType: 'purchase_receipt_recorded' });

    expect(list).toHaveLength(95);
    expect(list[0].consumerJobs).toEqual([
      expect.objectContaining({ event_id: 'evt-1', consumer_name: 'notification' }),
    ]);
    expect(
      db.getPrepareCalls().filter(
        (sql) => sql.includes('FROM outbox_consumer_jobs') && !sql.includes('FROM domain_outbox')
      ).length
    ).toBeGreaterThan(1);
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

  it('falls back to null when persisted replay summary json is invalid', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: [] })),
          first: vi.fn(async () => {
            if (sql.includes('SELECT * FROM outbox_replay_runs WHERE id = ?')) {
              return {
                id: 'replay-1',
                scope_type: 'event',
                scope_id: 'evt-1',
                status: 'completed',
                summary_json: '{',
              };
            }

            return null;
          }),
          run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
        })),
      })),
    };
    const repo = new OutboxReplayRepository(db, {
      now: () => 1710000011111,
      idFactory: () => 'replay-1',
    });

    const result = await repo.finalizeReplayRun('replay-1', { delivered: 1 });

    expect(result).toEqual(expect.objectContaining({
      id: 'replay-1',
      summary_json: null,
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
