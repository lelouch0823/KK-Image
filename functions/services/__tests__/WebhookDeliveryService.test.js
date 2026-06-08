import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryService } from '../WebhookDeliveryService.js';

function createWebhookRepoStub(overrides = {}) {
  return {
    listActiveByEvent: vi.fn(async () => []),
    getDeliveryStates: vi.fn(async () => new Map()),
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
    expect(webhookRepo.getDeliveryStates).toHaveBeenCalledWith(['evt-1:wh-1:v1']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
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

  it('falls back to an empty payload object when payload_json is invalid', () => {
    const service = new WebhookDeliveryService(
      {},
      {
        webhookRepo: createWebhookRepoStub(),
        fetch: vi.fn(),
        signPayload: vi.fn(async () => 'sig-1'),
        now: () => 1710000022222,
      }
    );

    expect(
      service.buildEnvelope({
        event_id: 'evt-invalid',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-invalid',
        payload_json: '{',
      })
    ).toEqual(
      expect.objectContaining({
        payload: {},
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
      getDeliveryStates: vi.fn(
        async () =>
          new Map([
            [
              'evt-2:wh-1:v1',
              { deliveryKey: 'evt-2:wh-1:v1', hasSuccess: true, latestAttemptNumber: 1 },
            ],
          ])
      ),
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
    expect(webhookRepo.hasSuccessfulDelivery).not.toHaveBeenCalled();
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

  it('rejects stored private webhook URLs before fetch', async () => {
    const webhookRepo = createWebhookRepoStub({
      listActiveByEvent: vi.fn(async () => [
        {
          id: 'wh-private',
          url: 'http://169.254.169.254/latest/meta-data',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
      ]),
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
      event_id: 'evt-private',
      event_type: 'purchase_receipt_recorded',
      aggregate_type: 'purchase_receipt',
      aggregate_id: 'receipt-private',
      payload_json: '{}',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webhookRepo.logAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookId: 'wh-private',
        classification: 'retryable',
        success: false,
        response: expect.stringContaining('内网地址'),
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

  it('delivers endpoints under the configured concurrency limit', async () => {
    const releases = [];
    const started = [];
    let activeCount = 0;
    let maxActiveCount = 0;
    const webhookRepo = createWebhookRepoStub({
      listActiveByEvent: vi.fn(async () => [
        {
          id: 'wh-1',
          url: 'https://example.com/one',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
        {
          id: 'wh-2',
          url: 'https://example.com/two',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
        {
          id: 'wh-3',
          url: 'https://example.com/three',
          events: ['purchase_receipt_recorded'],
          secret: null,
          headers: {},
          enabled: true,
        },
      ]),
    });
    const fetchMock = vi.fn(async (url) => {
      started.push(url);
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await new Promise((resolve) => {
        releases.push(() => {
          activeCount -= 1;
          resolve();
        });
      });
      return new Response('ok', { status: 200 });
    });
    const service = new WebhookDeliveryService(
      {},
      {
        webhookRepo,
        fetch: fetchMock,
        signPayload: vi.fn(async () => 'sig-1'),
        endpointConcurrency: 2,
        now: () => 1710000022222,
      }
    );

    const deliveryPromise = service.deliverDomainEvent({
      event_id: 'evt-5',
      event_type: 'purchase_receipt_recorded',
      aggregate_type: 'purchase_receipt',
      aggregate_id: 'receipt-5',
      payload_json: JSON.stringify({ purchase_order_id: 'po-5' }),
    });

    await vi.waitFor(() => {
      expect(started).toEqual(['https://example.com/one', 'https://example.com/two']);
    });

    releases.shift()?.();

    await vi.waitFor(() => {
      expect(started).toEqual([
        'https://example.com/one',
        'https://example.com/two',
        'https://example.com/three',
      ]);
    });

    releases.splice(0).forEach((release) => release());

    const result = await deliveryPromise;
    expect(maxActiveCount).toBe(2);
    expect(result.deliveries).toHaveLength(3);
  });
});
