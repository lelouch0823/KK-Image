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
      content: '{"key":"notification.purchase_receipt_recorded_desc","qty":3,"purchaseOrderId":"po-1"}',
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
          purchase_order_id: 'po-2',
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
      content: '{"key":"notification.order_procurement_progressed_desc","qty":2,"status":"partially_arrived","purchaseOrderId":"po-2"}',
      receiver: 'admin',
      orderId: 'o-2',
      sourceConsumer: 'notification',
      sourceEventId: 'evt-2',
      dedupeKey: 'order_procurement_progressed:evt-2:admin',
    }));
  });

  it('creates reversal notifications with localized procurement rollback content', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-rollback',
        event_id: 'evt-rollback',
        event_type: 'order_procurement_reversed',
        aggregate_type: 'order',
        aggregate_id: 'o-rollback',
        payload_json: JSON.stringify({
          purchase_order_id: 'po-rollback',
          reversal_qty: 2,
          order_procurement_status_after: 'ordered',
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      title: '{"key":"notification.order_procurement_reversed"}',
      content: '{"key":"notification.order_procurement_reversed_desc","qty":2,"status":"ordered","purchaseOrderId":"po-rollback"}',
      receiver: 'admin',
      orderId: 'o-rollback',
      dedupeKey: 'order_procurement_reversed:evt-rollback:admin',
    }));
  });

  it('creates one sales notification from order_created_by_admin', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-4',
        event_id: 'evt-4',
        event_type: 'order_created_by_admin',
        aggregate_type: 'order',
        aggregate_id: 'o-4',
        payload_json: JSON.stringify({
          order_id: 'o-4',
          order_no: 'SO-4',
          salesperson_id: 'sp-4',
          actor_name: 'Admin',
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      receiver: 'sales',
      salespersonId: 'sp-4',
      orderId: 'o-4',
      sourceConsumer: 'notification',
      sourceEventId: 'evt-4',
      dedupeKey: 'order_created_by_admin:evt-4:sales:sp-4',
      metadata: expect.objectContaining({
        eventType: 'order_created_by_admin',
      }),
    }));
  });

  it('creates one admin notification from order_updated_by_sales', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-5',
        event_id: 'evt-5',
        event_type: 'order_updated_by_sales',
        aggregate_type: 'order',
        aggregate_id: 'o-5',
        payload_json: JSON.stringify({
          order_id: 'o-5',
          order_no: 'SO-5',
          salesperson_id: 'sp-5',
          actor_name: 'Alice',
          change_count: 2,
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      receiver: 'admin',
      salespersonId: null,
      orderId: 'o-5',
      sourceConsumer: 'notification',
      sourceEventId: 'evt-5',
      dedupeKey: 'order_updated_by_sales:evt-5:admin',
      metadata: expect.objectContaining({
        eventType: 'order_updated_by_sales',
      }),
    }));
  });

  it('creates one admin reminder notification from order_pending_reminder_due', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-6',
        event_id: 'evt-6',
        event_type: 'order_pending_reminder_due',
        aggregate_type: 'order',
        aggregate_id: 'o-6',
        payload_json: JSON.stringify({
          order_id: 'o-6',
          order_no: 'SO-6',
          receiver: 'admin',
          sub_type: 'pending_timeout',
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order',
      receiver: 'admin',
      orderId: 'o-6',
      sourceEventId: 'evt-6',
      dedupeKey: 'order_pending_reminder_due:evt-6:admin',
      metadata: expect.objectContaining({
        eventType: 'order_pending_reminder_due',
      }),
    }));
  });

  it('creates one sales deadline reminder notification from order_deadline_reminder_due', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-7',
        event_id: 'evt-7',
        event_type: 'order_deadline_reminder_due',
        aggregate_type: 'order',
        aggregate_id: 'o-7',
        payload_json: JSON.stringify({
          order_id: 'o-7',
          order_no: 'SO-7',
          deadline: '2026-04-01',
          receiver: 'sales',
          salesperson_id: 'sp-7',
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'deadline',
      receiver: 'sales',
      salespersonId: 'sp-7',
      orderId: 'o-7',
      sourceEventId: 'evt-7',
      dedupeKey: 'order_deadline_reminder_due:evt-7:sales:sp-7',
      metadata: expect.objectContaining({
        eventType: 'order_deadline_reminder_due',
      }),
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

  it('creates manual admin notifications from admin_notification_created events', async () => {
    const result = await DOMAIN_OUTBOX_CONSUMERS.notification({
      db: {},
      baseUrl: 'https://kk.example.com',
      event: {
        id: 'job-notification-8',
        event_id: 'evt-8',
        event_type: 'admin_notification_created',
        aggregate_type: 'notification',
        aggregate_id: 'manual-1',
        payload_json: JSON.stringify({
          type: 'system',
          title: 'System maintenance',
          content: 'Window tonight',
          link: '/admin/ops',
          order_id: 'o-8',
          metadata: { level: 'info' },
        }),
      },
    });

    expect(result).toEqual({
      id: 'notification-1',
      created: true,
    });
    expect(mocks.createFromDomainEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system',
      title: 'System maintenance',
      content: 'Window tonight',
      link: '/admin/ops',
      receiver: 'admin',
      orderId: 'o-8',
      dedupeKey: 'admin_notification_created:evt-8:admin',
      metadata: expect.objectContaining({
        payload: expect.objectContaining({
          metadata: { level: 'info' },
        }),
      }),
    }));
  });
});
