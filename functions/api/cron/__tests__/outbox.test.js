import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isCronAuthorized: vi.fn(),
  claimJobs: vi.fn(),
  markPublished: vi.fn(async () => ({})),
  markFailed: vi.fn(async () => ({})),
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
    markPublished: mocks.markPublished,
    markFailed: mocks.markFailed,
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

import { onRequest } from '../outbox.js';

describe('cron outbox poller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCronAuthorized.mockReturnValue(true);
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
      }]);
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
      }),
    }));
    expect(mocks.auditConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-audit-1' }),
      baseUrl: 'https://kk.example.com',
    }));
    expect(mocks.cacheConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-cache-1' }),
      baseUrl: 'https://kk.example.com',
    }));
    expect(mocks.notificationConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-notification-1', event_id: 'evt-3' }),
      baseUrl: 'https://kk.example.com',
    }));
    expect(mocks.webhookConsumer).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ id: 'job-webhook-1', event_id: 'evt-4' }),
      baseUrl: 'https://kk.example.com',
    }));
    expect(mocks.markPublished).toHaveBeenCalledTimes(4);
    expect(mocks.markFailed).not.toHaveBeenCalled();
  });
});
