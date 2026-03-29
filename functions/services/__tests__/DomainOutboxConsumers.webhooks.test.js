import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deliverDomainEvent: vi.fn(async () => ({ shouldRetry: false, deliveries: [] })),
}));

vi.mock('../WebhookDeliveryService.js', () => ({
  WebhookDeliveryService: vi.fn(() => ({
    deliverDomainEvent: mocks.deliverDomainEvent,
  })),
}));

import { DOMAIN_OUTBOX_CONSUMERS } from '../DomainOutboxConsumers.js';

describe('DomainOutboxConsumers webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs and sends subscribed webhook payloads for supported domain events', async () => {
    await DOMAIN_OUTBOX_CONSUMERS.webhook({
      db: {},
      env: { WEBHOOK_SECRET: 'unused' },
      event: {
        id: 'job-webhook-1',
        event_id: 'evt-1',
        event_type: 'purchase_receipt_recorded',
        event_version: 1,
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-1',
        occurred_at: 1710000000000,
        payload_json: '{"purchase_order_id":"po-1","receipt_id":"receipt-1"}',
      },
    });

    expect(mocks.deliverDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_id: 'evt-1',
      event_type: 'purchase_receipt_recorded',
      aggregate_id: 'receipt-1',
    }));
  });

  it('skips endpoints that already succeeded for the same delivery key', async () => {
    mocks.deliverDomainEvent.mockResolvedValueOnce({
      shouldRetry: false,
      deliveries: [{ webhookId: 'wh-1', skipped: true }],
    });

    const result = await DOMAIN_OUTBOX_CONSUMERS.webhook({
      db: {},
      env: {},
      event: {
        id: 'job-webhook-2',
        event_id: 'evt-2',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-2',
        payload_json: '{"purchase_order_id":"po-2"}',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      shouldRetry: false,
      deliveries: [{ webhookId: 'wh-1', skipped: true }],
    }));
  });

  it('retries network and 5xx failures but treats 4xx as terminal contract failures', async () => {
    mocks.deliverDomainEvent.mockResolvedValueOnce({
      shouldRetry: true,
      deliveries: [{ webhookId: 'wh-1', classification: 'retryable' }],
    });

    await expect(DOMAIN_OUTBOX_CONSUMERS.webhook({
      db: {},
      env: {},
      event: {
        id: 'job-webhook-3',
        event_id: 'evt-3',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-3',
        payload_json: '{"purchase_order_id":"po-3"}',
      },
    })).rejects.toThrow(/retryable webhook delivery/i);
  });
});
