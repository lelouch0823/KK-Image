import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isCronAuthorized: vi.fn(),
  claimJobs: vi.fn(),
  countAvailableJobs: vi.fn(async () => 0),
  markPublished: vi.fn(async () => ({})),
  markFailed: vi.fn(async () => ({})),
  tryAcquire: vi.fn(async () => ({
    scope: 'default',
    leaseToken: 'lease-1',
    workerId: 'worker-1',
    leaseUntil: 1710000030000,
  })),
  finishLease: vi.fn(async () => ({})),
  auditConsumer: vi.fn(async () => {}),
  cacheConsumer: vi.fn(async () => {}),
  notificationConsumer: vi.fn(async () => {}),
  webhookConsumer: vi.fn(async () => {}),
}));

vi.mock('../../utils/cron-auth.js', async () => {
  const actual = await vi.importActual('../../utils/cron-auth.js');
  return {
    ...actual,
    isCronAuthorized: mocks.isCronAuthorized,
  };
});

vi.mock('../../../services/DomainOutboxDispatchService.js', () => ({
  DomainOutboxDispatchService: vi.fn(() => ({
    claimJobs: mocks.claimJobs,
    countAvailableJobs: mocks.countAvailableJobs,
    markPublished: mocks.markPublished,
    markFailed: mocks.markFailed,
  })),
}));

vi.mock('../../../repositories/OutboxRuntimeStateRepository.js', () => ({
  OutboxRuntimeStateRepository: vi.fn(() => ({
    tryAcquire: mocks.tryAcquire,
    finishLease: mocks.finishLease,
  })),
}));

vi.mock('../../../services/DomainOutboxConsumers.js', () => ({
  DOMAIN_OUTBOX_CONSUMERS: {
    audit: mocks.auditConsumer,
    cache: mocks.cacheConsumer,
    notification: mocks.notificationConsumer,
    webhook: mocks.webhookConsumer,
  },
}));

import { onRequest, runOutboxPoller } from '../outbox.js';

describe('cron outbox poller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCronAuthorized.mockReturnValue(true);
    mocks.countAvailableJobs.mockResolvedValue(0);
    mocks.tryAcquire.mockResolvedValue({
      scope: 'default',
      leaseToken: 'lease-1',
      workerId: 'worker-1',
      leaseUntil: 1710000030000,
    });
    mocks.claimJobs
      .mockResolvedValueOnce([{
        id: 'job-audit-1',
        consumer_name: 'audit',
        event_id: 'evt-1',
        event_type: 'purchase_receipt_recorded',
        payload_json: '{"purchase_order_id":"po-1"}',
      }])
      .mockResolvedValueOnce([{
        id: 'job-cache-1',
        consumer_name: 'cache',
        event_id: 'evt-2',
        event_type: 'order_procurement_progressed',
        payload_json: '{"purchase_order_id":"po-1","order_id":"o-1"}',
      }])
      .mockResolvedValueOnce([{
        id: 'job-notification-1',
        consumer_name: 'notification',
        event_id: 'evt-3',
        event_type: 'purchase_receipt_recorded',
        payload_json: '{"purchase_order_id":"po-1","order_id":"o-1","receipt_id":"receipt-1"}',
      }])
      .mockResolvedValueOnce([{
        id: 'job-webhook-1',
        consumer_name: 'webhook',
        event_id: 'evt-4',
        event_type: 'purchase_receipt_recorded',
        payload_json: '{"purchase_order_id":"po-1","receipt_id":"receipt-1"}',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it('runs the outbox poller and returns processed counts', async () => {
    const response = await onRequest({
      env: { DB: {}, CRON_SECRET: 'secret' },
      request: new Request('https://kk.example.com/api/cron/outbox', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
      }),
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        claimed: 4,
        published: 4,
        failed: 0,
        rounds: 1,
        skipped: false,
        backlog: 0,
      }),
    }));
    expect(mocks.auditConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-audit-1' }),
      baseUrl: 'https://kk.example.com',
      state: expect.any(Object),
    }));
    expect(mocks.cacheConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-cache-1' }),
      baseUrl: 'https://kk.example.com',
      state: expect.any(Object),
    }));
    expect(mocks.notificationConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-notification-1', event_id: 'evt-3' }),
      baseUrl: 'https://kk.example.com',
      state: expect.any(Object),
    }));
    expect(mocks.webhookConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-webhook-1', event_id: 'evt-4' }),
      baseUrl: 'https://kk.example.com',
      state: expect.any(Object),
    }));
    expect(mocks.markPublished).toHaveBeenCalledTimes(4);
    expect(mocks.markFailed).not.toHaveBeenCalled();
    expect(mocks.finishLease).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'default',
      leaseToken: 'lease-1',
      claimed: 4,
      published: 4,
      failed: 0,
      rounds: 1,
      backlog: 0,
    }));
  });

  it('processes jobs within a consumer under the configured concurrency limit', async () => {
    const releases = [];
    const started = [];
    let activeCount = 0;
    let maxActiveCount = 0;

    mocks.claimJobs.mockReset();
    mocks.claimJobs
      .mockResolvedValueOnce([
        {
          id: 'job-audit-1',
          consumer_name: 'audit',
          event_id: 'evt-1',
          event_type: 'purchase_receipt_recorded',
          payload_json: '{}',
        },
        {
          id: 'job-audit-2',
          consumer_name: 'audit',
          event_id: 'evt-2',
          event_type: 'purchase_receipt_recorded',
          payload_json: '{}',
        },
        {
          id: 'job-audit-3',
          consumer_name: 'audit',
          event_id: 'evt-3',
          event_type: 'purchase_receipt_recorded',
          payload_json: '{}',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mocks.auditConsumer.mockImplementation(async ({ job }) => {
      started.push(job.id);
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await new Promise((resolve) => {
        releases.push(() => {
          activeCount -= 1;
          resolve();
        });
      });
    });

    const pollerPromise = runOutboxPoller({
      env: { DB: {} },
      requestUrl: 'https://kk.example.com/api/cron/outbox',
      jobConcurrency: 2,
    });

    await vi.waitFor(() => {
      expect(started).toEqual(['job-audit-1', 'job-audit-2']);
    });

    releases.shift()?.();

    await vi.waitFor(() => {
      expect(started).toEqual(['job-audit-1', 'job-audit-2', 'job-audit-3']);
    });

    releases.splice(0).forEach((release) => release());

    const result = await pollerPromise;
    expect(result).toEqual(expect.objectContaining({
      claimed: 3,
      published: 3,
      failed: 0,
      rounds: 1,
      skipped: false,
      backlog: 0,
    }));
    expect(maxActiveCount).toBe(2);
  });

  it('uses bounded request-path defaults when forced by a route worker id', async () => {
    mocks.claimJobs.mockReset();
    mocks.claimJobs
      .mockResolvedValueOnce([{
        id: 'job-audit-1',
        consumer_name: 'audit',
        event_id: 'evt-1',
        event_type: 'purchase_order_status_changed',
        payload_json: '{}',
      }])
      .mockResolvedValueOnce([{
        id: 'job-cache-1',
        consumer_name: 'cache',
        event_id: 'evt-2',
        event_type: 'purchase_order_status_changed',
        payload_json: '{}',
      }])
      .mockResolvedValueOnce([{
        id: 'job-notification-1',
        consumer_name: 'notification',
        event_id: 'evt-3',
        event_type: 'order_procurement_progressed',
        payload_json: '{}',
      }])
      .mockResolvedValueOnce([{
        id: 'job-webhook-1',
        consumer_name: 'webhook',
        event_id: 'evt-4',
        event_type: 'order_procurement_progressed',
        payload_json: '{}',
      }]);

    const result = await runOutboxPoller({
      env: { DB: {} },
      requestUrl: 'https://kk.example.com/api/manage/purchase-orders/po-1/status',
      workerId: 'purchase_order_status_changed:po-1',
    });

    expect(result).toEqual(expect.objectContaining({
      claimed: 4,
      published: 4,
      failed: 0,
      rounds: 1,
      skipped: false,
      backlog: 0,
    }));
    expect(mocks.claimJobs).toHaveBeenCalledTimes(4);
    expect(mocks.claimJobs).toHaveBeenNthCalledWith(
      1,
      'audit',
      'purchase_order_status_changed:po-1',
      expect.any(Number),
      10
    );
    expect(mocks.claimJobs).toHaveBeenNthCalledWith(
      2,
      'cache',
      'purchase_order_status_changed:po-1',
      expect.any(Number),
      10
    );
    expect(mocks.claimJobs).toHaveBeenNthCalledWith(
      3,
      'notification',
      'purchase_order_status_changed:po-1',
      expect.any(Number),
      10
    );
    expect(mocks.claimJobs).toHaveBeenNthCalledWith(
      4,
      'webhook',
      'purchase_order_status_changed:po-1',
      expect.any(Number),
      10
    );
    expect(mocks.tryAcquire).toHaveBeenCalledWith(expect.objectContaining({
      workerId: 'purchase_order_status_changed:po-1',
      force: false,
      minRunIntervalMs: 0,
    }));
  });

  it('skips processing when another poller lease is still active', async () => {
    mocks.tryAcquire.mockResolvedValueOnce(null);
    mocks.claimJobs.mockReset();

    const result = await runOutboxPoller({
      env: { DB: {} },
      requestUrl: 'https://kk.example.com/api/cron/outbox',
    });

    expect(result).toEqual({
      claimed: 0,
      published: 0,
      failed: 0,
      rounds: 0,
      skipped: true,
      backlog: null,
      consumers: {
        audit: { claimed: 0, published: 0, failed: 0 },
        cache: { claimed: 0, published: 0, failed: 0 },
        notification: { claimed: 0, published: 0, failed: 0 },
        webhook: { claimed: 0, published: 0, failed: 0 },
      },
    });
    expect(mocks.claimJobs).not.toHaveBeenCalled();
    expect(mocks.finishLease).not.toHaveBeenCalled();
  });
});
