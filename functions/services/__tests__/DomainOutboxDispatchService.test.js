import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainOutboxDispatchService } from '../DomainOutboxDispatchService.js';

function createPreparedStatement(
  sql,
  { allResult = { results: [] }, runResult = { meta: { changes: 1 } } } = {}
) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    all: vi.fn(async () => allResult),
    first: vi.fn(async () => allResult?.results?.[0] || null),
    run: vi.fn(async () => runResult),
  };
  return statement;
}

function createMockDb({ pendingJobs = [], staleJobs = [], availableJobsCount = null } = {}) {
  return {
    prepare: vi.fn((sql) => {
      if (sql.includes('FROM outbox_consumer_jobs jobs') && sql.includes('jobs.status IN')) {
        return createPreparedStatement(sql, {
          allResult: {
            results: [...pendingJobs, ...staleJobs],
          },
        });
      }
      if (sql.includes('SELECT COUNT(*) AS total') && sql.includes('FROM outbox_consumer_jobs')) {
        return createPreparedStatement(sql, {
          allResult: {
            results: [{ total: availableJobsCount ?? pendingJobs.length + staleJobs.length }],
          },
        });
      }
      return createPreparedStatement(sql);
    }),
    batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
  };
}

describe('DomainOutboxDispatchService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('claims pending jobs with a lease and skips already leased jobs', async () => {
    const db = createMockDb({
      pendingJobs: [
        {
          id: 'job-1',
          consumer_name: 'audit',
          event_id: 'evt-1',
          status: 'pending',
          attempt_count: 0,
          available_at: 1700000000000,
          leased_until: null,
          event_type: 'purchase_receipt_recorded',
          aggregate_type: 'purchase_receipt',
          aggregate_id: 'receipt-1',
          payload_json: '{"receipt_id":"receipt-1"}',
        },
      ],
    });
    const service = new DomainOutboxDispatchService(db, {
      leaseMs: 60000,
      now: () => 1710000000000,
    });

    const claimed = await service.claimJobs('audit', 'worker-1', 1710000000000, 10);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toEqual(
      expect.objectContaining({
        id: 'job-1',
        leased_by: 'worker-1',
        leased_until: 1710000060000,
      })
    );
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0][0].sql).toContain('UPDATE outbox_consumer_jobs');
  });

  it('reclaims stale processing jobs after lease expiry', async () => {
    const db = createMockDb({
      staleJobs: [
        {
          id: 'job-2',
          consumer_name: 'cache',
          event_id: 'evt-2',
          status: 'processing',
          attempt_count: 2,
          available_at: 1700000000000,
          leased_until: 1709999999999,
          event_type: 'inventory_received',
          aggregate_type: 'inventory_event',
          aggregate_id: 'ie-1',
          payload_json: '{"inventory_event_id":"ie-1"}',
        },
      ],
    });
    const service = new DomainOutboxDispatchService(db, {
      leaseMs: 30000,
      now: () => 1710000000000,
    });

    const claimed = await service.claimJobs('cache', 'worker-2', 1710000000000, 10);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toEqual(
      expect.objectContaining({
        id: 'job-2',
        leased_by: 'worker-2',
        leased_until: 1710000030000,
        status: 'processing',
      })
    );
  });

  it('marks jobs published or failed with retry backoff', async () => {
    const db = createMockDb();
    const service = new DomainOutboxDispatchService(db, {
      retryBackoffMs: (attemptCount) => attemptCount * 1000,
      now: () => 1710000000000,
    });

    await service.markPublished('job-1', 1710000000000);
    await service.markFailed(
      {
        id: 'job-2',
        attempt_count: 2,
      },
      new Error('consumer failed'),
      1710000000000
    );

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("SET status = 'published'"));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("SET status = 'failed'"));
    const failedStatement = db.prepare.mock.results
      .map((result) => result.value)
      .find((statement) => statement.sql.includes("SET status = 'failed'"));
    expect(failedStatement.params[0]).toBe(1710000003000);
    expect(failedStatement.params[1]).toContain('consumer failed');
  });

  it('chunks large job claims into D1-safe batches', async () => {
    const db = createMockDb({
      pendingJobs: Array.from({ length: 205 }, (_, index) => ({
        id: `job-${index}`,
        consumer_name: 'cache',
        event_id: `evt-${index}`,
        status: 'pending',
        attempt_count: 0,
        available_at: 1700000000000,
        leased_until: null,
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: `order-${index}`,
        payload_json: JSON.stringify({ order_id: `order-${index}` }),
      })),
    });
    const service = new DomainOutboxDispatchService(db, {
      leaseMs: 30000,
      now: () => 1710000000000,
    });

    const claimed = await service.claimJobs('cache', 'worker-3', 1710000000000, 205);

    expect(claimed).toHaveLength(205);
    expect(db.batch).toHaveBeenCalledTimes(3);
    expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
  });

  it('counts immediately available and expired leased jobs', async () => {
    const db = createMockDb({ availableJobsCount: 7 });
    const service = new DomainOutboxDispatchService(db, {
      now: () => 1710000000000,
    });

    const total = await service.countAvailableJobs(1710000000000);

    expect(total).toBe(7);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) AS total'));
  });
});
