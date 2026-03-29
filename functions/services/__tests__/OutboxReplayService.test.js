import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxReplayService } from '../OutboxReplayService.js';

function createReplayRepoStub(overrides = {}) {
  return {
    findEventsByScope: vi.fn(async () => []),
    createReplayRun: vi.fn(async ({ scopeType, scopeId, consumerName = null, dryRun = true, requestedBy = null }) => ({
      id: `run:${scopeType}:${scopeId}:${dryRun ? 'dry' : 'live'}`,
      scope_type: scopeType,
      scope_id: scopeId,
      consumer_name: consumerName,
      dry_run: dryRun ? 1 : 0,
      status: 'pending',
      requested_by: requestedBy,
    })),
    finalizeReplayRun: vi.fn(async (runId, summary, status = 'completed') => ({
      id: runId,
      status,
      summary_json: summary,
    })),
    ...overrides,
  };
}

describe('OutboxReplayService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dry-runs replay targets without mutating consumer state', async () => {
    const repo = createReplayRepoStub({
      findEventsByScope: vi.fn(async () => [
        {
          id: 'evt-1',
          event_type: 'purchase_receipt_recorded',
          event_id: 'evt-1',
        },
      ]),
    });
    const consumers = {
      notification: vi.fn(async () => ({})),
    };
    const service = new OutboxReplayService({}, {
      outboxReplayRepo: repo,
      consumers,
      eventCatalog: {
        purchase_receipt_recorded: { consumers: ['notification'] },
      },
      auditRecorder: vi.fn(async () => {}),
    });

    const result = await service.dryRun({
      scopeType: 'event',
      scopeId: 'evt-1',
      consumerName: 'notification',
      requestedBy: 'admin-1',
    });

    expect(consumers.notification).not.toHaveBeenCalled();
    expect(repo.createReplayRun).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      scopeType: 'event',
      scopeId: 'evt-1',
    }));
    expect(result).toEqual(expect.objectContaining({
      runId: 'run:event:evt-1:dry',
      dryRun: true,
      targetedEventIds: ['evt-1'],
      consumerNames: ['notification'],
    }));
  });

  it('replays only side-effect consumers and records a replay run summary', async () => {
    const repo = createReplayRepoStub({
      findEventsByScope: vi.fn(async () => [
        {
          id: 'evt-1',
          event_id: 'evt-1',
          event_type: 'purchase_receipt_recorded',
          aggregate_type: 'purchase_receipt',
          aggregate_id: 'receipt-1',
          payload_json: '{"purchase_order_id":"po-1"}',
        },
      ]),
    });
    const consumers = {
      notification: vi.fn(async () => ({ created: false })),
      webhook: vi.fn(async () => ({ shouldRetry: false })),
    };
    const auditRecorder = vi.fn(async () => {});
    const service = new OutboxReplayService({}, {
      outboxReplayRepo: repo,
      consumers,
      eventCatalog: {
        purchase_receipt_recorded: { consumers: ['notification', 'webhook'] },
      },
      auditRecorder,
    });

    const result = await service.executeReplay({
      scopeType: 'command',
      scopeId: 'cmd-1',
      requestedBy: 'admin-1',
    });

    expect(consumers.notification).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'evt-1' }),
      replay: expect.objectContaining({
        runId: 'run:command:cmd-1:live',
        requestedBy: 'admin-1',
        mode: 'operator_replay',
        dryRun: false,
      }),
    }));
    expect(consumers.webhook).toHaveBeenCalledTimes(1);
    expect(auditRecorder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      domain: 'audit-replay',
      action: 'outbox.replay.execute',
      targetId: 'evt-1',
      metadata: expect.objectContaining({
        replayRunId: 'run:command:cmd-1:live',
      }),
    }));
    expect(repo.finalizeReplayRun).toHaveBeenCalledWith(
      'run:command:cmd-1:live',
      expect.objectContaining({
        replayedCount: 2,
        targetedEventIds: ['evt-1'],
      }),
      'completed'
    );
    expect(result).toEqual(expect.objectContaining({
      runId: 'run:command:cmd-1:live',
      dryRun: false,
      replayedCount: 2,
    }));
  });

  it('rejects attempts to replay unknown or core-truth consumers', async () => {
    const repo = createReplayRepoStub({
      findEventsByScope: vi.fn(async () => [
        {
          id: 'evt-1',
          event_id: 'evt-1',
          event_type: 'purchase_receipt_recorded',
        },
      ]),
    });
    const service = new OutboxReplayService({}, {
      outboxReplayRepo: repo,
      consumers: {
        notification: vi.fn(async () => ({})),
      },
      eventCatalog: {
        purchase_receipt_recorded: { consumers: ['notification'] },
      },
      auditRecorder: vi.fn(async () => {}),
    });

    await expect(service.executeReplay({
      scopeType: 'event',
      scopeId: 'evt-1',
      consumerName: 'purchase_receipt_command',
      requestedBy: 'admin-1',
    })).rejects.toThrow(/not replayable|unsupported/i);
  });
});
