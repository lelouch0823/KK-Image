import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  confirmDelivery: vi.fn(),
  orderFindById: vi.fn(),
  addTimelineEntry: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../../services/OrderDeliveryService.js', () => ({
  OrderDeliveryService: vi.fn(() => ({
    confirmDelivery: mocks.confirmDelivery,
  })),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.orderFindById,
    timelineRepo: {
      addTimelineEntry: mocks.addTimelineEntry,
    },
  })),
}));

vi.mock('../../../../../../api/utils/validation.js', () => ({
  validateProductVariantBinding: vi.fn(),
}));

vi.mock('../../../../../../api/utils/order-state-machine.js', () => ({
  canTransitionOrderStatus: vi.fn(() => true),
}));

vi.mock('../authz-helpers.js', () => ({
  assertAdminFull: vi.fn(async () => {}),
  assertForceStatusTransitionAllowed: vi.fn(async () => {}),
}));

vi.mock('../error-helpers.js', () => ({
  isInsufficientStockError: vi.fn(() => false),
  isInvalidStatusTransitionError: vi.fn(() => false),
}));

vi.mock('../../../../../../services/DemandService.js', () => ({
  DemandService: vi.fn(() => ({
    syncOrderTransition: vi.fn(async () => {}),
  })),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

vi.mock('../../../../../../api/utils/order-utils.js', () => ({
  processOrderUpdate: vi.fn(),
}));

import detailRoutesApp from '../detail/index.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', detailRoutesApp);
  return app;
}

describe('manage order delivery confirmation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmDelivery.mockResolvedValue({
      orderId: 'o-1',
      deliveryStatus: 'delivered',
      deliveredAt: 1710000000000,
      deliveredBy: 'Admin',
      deliveryNote: 'signed by receiver',
    });
    mocks.orderFindById
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'fulfilled',
        deliveryStatus: 'in_transit',
        deliveryConfirmedAt: null,
        deliveryConfirmedBy: '',
        deliveryNote: '',
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'fulfilled',
        deliveryStatus: 'delivered',
        deliveryConfirmedAt: 1710000000000,
        deliveryConfirmedBy: 'Admin',
        deliveryNote: 'signed by receiver',
      });
  });

  it('confirms delivery, records timeline, and returns the refreshed order detail', async () => {
    const app = createApp();
    const waitUntil = vi.fn();

    const res = await app.request(
      'http://localhost/api/manage/orders/o-1/delivery-confirmation',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'signed by receiver' }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.confirmDelivery).toHaveBeenCalledWith(
      'o-1',
      { note: 'signed by receiver' },
      expect.objectContaining({
        actorId: 'admin-1',
        actorName: 'Admin',
      })
    );
    expect(mocks.addTimelineEntry).toHaveBeenCalledWith(
      'o-1',
      expect.objectContaining({
        actionType: 'field_updated',
        fieldName: 'delivery_status',
        oldValue: 'in_transit',
        newValue: 'delivered',
      })
    );
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_delivery_confirmed',
        aggregate_type: 'order',
        aggregate_id: 'o-1',
        payload: expect.objectContaining({
          order_id: 'o-1',
          order_no: 'SO-1',
          delivery_status: 'delivered',
          actor_name: 'Admin',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });
});
