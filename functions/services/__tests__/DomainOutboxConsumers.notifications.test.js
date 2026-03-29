import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const createdByDedupeKey = new Map();

  return {
    createdByDedupeKey,
    createFromDomainEvent: vi.fn(async (input) => {
      const existing = createdByDedupeKey.get(input.dedupeKey);
      if (existing) {
        return {
          id: existing.id,
          created: false,
        };
      }

      const created = {
        id: `notification-${createdByDedupeKey.size + 1}`,
        created: true,
      };
      createdByDedupeKey.set(input.dedupeKey, created);
      return created;
    }),
    invalidateCache: vi.fn(async () => {}),
  };
});

vi.mock('../../repositories/NotificationRepository.js', () => ({
  NotificationRepository: vi.fn(() => ({
    createFromDomainEvent: mocks.createFromDomainEvent,
  })),
}));

vi.mock('../../lib/hono/middleware/cache.js', async () => {
  const actual = await vi.importActual('../../lib/hono/middleware/cache.js');
  return {
    ...actual,
    invalidateCache: mocks.invalidateCache,
  };
});

import { DOMAIN_OUTBOX_CONSUMERS } from '../DomainOutboxConsumers.js';

describe('DomainOutboxConsumers notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createdByDedupeKey.clear();
  });

  it('creates one admin notification from purchase_receipt_recorded', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-1',
        event_id: 'evt-1',
        event_type: 'purchase_receipt_recorded',
        aggregate_type: 'purchase_receipt',
        aggregate_id: 'receipt-1',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-1',
          order_id: 'o-1',
          receipt_id: 'receipt-1',
          received_qty: 3,
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order',
      title: '{"key":"notification.purchase_receipt_recorded"}',
      receiver: 'admin',
      orderId: 'o-1',
      sourceConsumer: 'notification',
      sourceEventId: 'evt-1',
      dedupeKey: 'purchase_receipt_recorded:evt-1:admin',
      metadata: expect.objectContaining({
        eventType: 'purchase_receipt_recorded',
        payload: expect.objectContaining({
          purchase_order_id: 'po-1',
          receipt_id: 'receipt-1',
        }),
      }),
    }));
    expect(mocks.invalidateCache).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateCache.mock.calls[0][0]).toEqual(expect.arrayContaining([
      'https://kk.example.com/api/manage/notifications',
      'https://kk.example.com/api/manage/notifications?limit=20',
    ]));
  });

  it('creates one admin notification from order_procurement_progressed', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-2',
        event_id: 'evt-2',
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: 'o-2',
        payload_json: JSON.stringify({
          order_line_id: 'line-2',
          order_procurement_status_after: 'partially_arrived',
          received_qty_delta: 2,
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      title: '{"key":"notification.order_procurement_progressed"}',
      receiver: 'admin',
      orderId: 'o-2',
      sourceConsumer: 'notification',
      sourceEventId: 'evt-2',
      dedupeKey: 'order_procurement_progressed:evt-2:admin',
    }));
  });

  it('does not duplicate notifications when the same event is retried or replayed', async () => {
    const event = {
      id: 'job-notification-3',
      event_id: 'evt-3',
      event_type: 'purchase_receipt_recorded',
      aggregate_type: 'purchase_receipt',
      aggregate_id: 'receipt-3',
      payload_json: JSON.stringify({
        purchase_order_id: 'po-3',
        order_id: 'o-3',
        receipt_id: 'receipt-3',
        received_qty: 1,
      }),
    };

    const first = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event,
    });
    const replay = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event,
    });

    expect(first).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(replay).toEqual({
      id: 'notification-1',
      created: false,
    });
    expect(mocks.createdByDedupeKey.size).toBe(1);
    expect(mocks.createFromDomainEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      dedupeKey: 'purchase_receipt_recorded:evt-3:admin',
    }));
    expect(mocks.createFromDomainEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      dedupeKey: 'purchase_receipt_recorded:evt-3:admin',
    }));
  });
});
