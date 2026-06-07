import { describe, expect, it } from 'vitest';

describe('buildOutboxOpsMetrics', () => {
  it('computes health and focus metrics from outbox events', async () => {
    const modulePromise = import('../outboxOpsSummary');

    await expect(modulePromise).resolves.toHaveProperty('buildOutboxOpsMetrics');

    const { buildOutboxOpsMetrics } = await modulePromise;

    const events = [
      {
        id: 'evt-1',
        created_at: '2026-04-13T08:00:00.000Z',
        consumerJobs: [
          { consumer_name: 'notification', status: 'failed' },
          { consumer_name: 'webhook', status: 'published' },
        ],
      },
      {
        id: 'evt-2',
        created_at: '2026-04-13T09:30:00.000Z',
        consumerJobs: [{ consumer_name: 'notification', status: 'processing' }],
      },
    ];

    expect(
      buildOutboxOpsMetrics(
        events,
        {
          eventType: 'purchase_receipt_recorded',
          consumerName: 'notification',
          status: 'failed',
        },
        {
          isLoading: true,
          isStale: true,
          refreshFailed: true,
        }
      )
    ).toEqual({
      totalEvents: 2,
      failedJobs: 1,
      activeJobs: 1,
      latestCreatedAt: '2026-04-13T09:30:00.000Z',
      selectedFilters: ['purchase_receipt_recorded', 'notification', 'failed'],
      hasFilters: true,
      isLoading: true,
      isStale: true,
      refreshFailed: true,
    });
  });
});
