import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryService } from '../WebhookDeliveryService.js';

function createWebhookRepoStub(overrides = {}) {
  return {
    listActiveByEvent: vi.fn(async () => []),
    hasSuccessfulDelivery: vi.fn(async () => false),
    getLatestAttempt: vi.fn(async () => null),
    logAttempt: vi.fn(async (input) => ({ id: 'whlog-1', ...input })),
    ...overrides,
  };
}

describe('WebhookDeliveryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('signs and sends subscribed webhook payloads for supported domain events', async () => {
    const webhookRepo = createWebhookRepoStub({
      listActiveByEvent: vi.fn(async () => [
        {
          id: 'wh-1',
          url: 'https://example.com/hook',
          events: ['purchase_receipt_recorded'],
          secret: 'secret-1',
          headers: { 'X-Custom': '1' },
          enabled: true,
        },
      ]),
    });
    const fetchMock = vi.fn(async () => new Response('ok', { status: 202 }));
    const signPayload = vi.fn(async () => 'sig-1');
    const service = new WebhookDeliveryService(
      {},
      {
        webhookRepo,
        fetch: fetchMock,
        signPayload,
        now: () => 1710000022222,
      }
    );

    const result = await service.deliverDomainEvent({
      event_id: 'evt-1',
      event_type: 'purchase_receipt_recorded',
      event_version: 1,
      occurred_at: 1710000000000,
      aggregate_type: 'purchase_receipt',
      aggregate_id: 'receipt-1',
      payload_json: JSON.stringify({
        purchase_order_id: 'po-1',
        receipt_id: 'receipt-1',
      }),
    });

    expect(signPayload).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': '1',
          'X-Webhook-Signature': 'sig-1',
        }),
      })
    );
    expect(webhookRepo.logAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookId: 'wh-1',
        eventId: 'evt-1',
        deliveryKey: 'evt-1:wh-1:v1',
        attemptNumber: 1,
        classification: 'delivered',
        success: true,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        shouldRetry: false,
        deliveries: [
          expect.objectContaining({
            webhookId: 'wh-1',
            deliveryKey: 'evt-1:wh-1:v1',
            classification: 'delivered',
          }),
        ],
      })
    );
  });

  it('skips endpoints that already succeeded for the same delivery key', async () => {
    const webhookRepo = createWebhookRepoStub({
      listActiveByEvent: vi.fn(async () => [
        {
          id: 'wh-1',
          url: 'https://example.com/hook',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
      ]),
      hasSuccessfulDelivery: vi.fn(async () => true),
    });
    const fetchMock = vi.fn();
    const service = new WebhookDeliveryService(
      {},
      {
        webhookRepo,
        fetch: fetchMock,
        signPayload: vi.fn(async () => 'sig-1'),
        now: () => 1710000022222,
      }
    );

    const result = await service.deliverDomainEvent({
      event_id: 'evt-2',
      event_type: 'purchase_receipt_recorded',
      event_version: 1,
      occurred_at: 1710000000000,
      aggregate_type: 'purchase_receipt',
      aggregate_id: 'receipt-2',
      payload_json: JSON.stringify({ purchase_order_id: 'po-2' }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webhookRepo.logAttempt).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        shouldRetry: false,
        deliveries: [
          expect.objectContaining({
            webhookId: 'wh-1',
            skipped: true,
          }),
        ],
      })
    );
  });

  it('retries network and 5xx failures but treats 4xx as terminal contract failures', async () => {
    const webhookRepo = createWebhookRepoStub({
      listActiveByEvent: vi.fn(async () => [
        {
          id: 'wh-1',
          url: 'https://example.com/retry',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
        {
          id: 'wh-2',
          url: 'https://example.com/terminal',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
      ]),
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response('bad request', { status: 422 }));
    const service = new WebhookDeliveryService(
      {},
      {
        webhookRepo,
        fetch: fetchMock,
        signPayload: vi.fn(async () => 'sig-1'),
        now: () => 1710000022222,
      }
    );

    const result = await service.deliverDomainEvent({
      event_id: 'evt-3',
      event_type: 'purchase_receipt_recorded',
      event_version: 1,
      occurred_at: 1710000000000,
      aggregate_type: 'purchase_receipt',
      aggregate_id: 'receipt-3',
      payload_json: JSON.stringify({ purchase_order_id: 'po-3' }),
    });

    expect(webhookRepo.logAttempt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        webhookId: 'wh-1',
        classification: 'retryable',
        success: false,
        nextRetryAt: expect.any(Number),
      })
    );
    expect(webhookRepo.logAttempt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        webhookId: 'wh-2',
        classification: 'terminal',
        success: false,
        nextRetryAt: null,
      })
    );
    expect(result.shouldRetry).toBe(true);
  });

  it('binds the platform fetch before delivering outbox webhooks', async () => {
    const webhookRepo = createWebhookRepoStub({
      listActiveByEvent: vi.fn(async () => [
        {
          id: 'wh-1',
          url: 'https://example.com/bound',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
      ]),
    });
    const originalFetch = globalThis.fetch;
    const fetchCalls = [];
    globalThis.fetch = vi.fn(async function platformFetch(url, init) {
      if (this !== globalThis) {
        throw new TypeError('illegal invocation');
      }
      fetchCalls.push({ url, init });
      return new Response('ok', { status: 200 });
    });

    try {
      const service = new WebhookDeliveryService(
        {},
        {
          webhookRepo,
          now: () => 1710000022222,
        }
      );

      await service.deliverDomainEvent({
        event_id: 'evt-4',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-4',
        payload_json: JSON.stringify({ purchase_order_id: 'po-4' }),
      });

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe('https://example.com/bound');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
