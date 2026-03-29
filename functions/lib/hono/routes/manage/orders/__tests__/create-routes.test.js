import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  createManagedOrder: vi.fn(),
  repoBatchUpdateStatus: vi.fn(),
  resolveSalesTokens: vi.fn(),
  scheduleOrderMutationCachesInvalidation: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../create-order.js', () => ({
  createManagedOrder: mocks.createManagedOrder,
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    batchUpdateStatus: mocks.repoBatchUpdateStatus,
  })),
}));

vi.mock('../cache-helpers.js', () => ({
  resolveSalesTokens: mocks.resolveSalesTokens,
  scheduleOrderMutationCachesInvalidation: mocks.scheduleOrderMutationCachesInvalidation,
}));

vi.mock('../authz-helpers.js', () => ({
  assertForceStatusTransitionAllowed: vi.fn(async () => {}),
}));

vi.mock('../../../../../../api/utils/order-state-machine.js', () => ({
  canTransitionOrderStatus: vi.fn(() => true),
}));

vi.mock('../error-helpers.js', () => ({
  isInsufficientStockError: vi.fn(() => false),
  isInvalidStatusTransitionError: vi.fn(() => false),
}));

vi.mock('../../../../_shared/utils.js', () => ({
  MSG: {
    COMMON: { INVALID_PARAMS: 'INVALID_PARAMS' },
    ORDER: {
      INVALID_STATUS: 'INVALID_STATUS',
      BATCH_RESULT: 'batch {valid}',
      ACTIONS: {
        confirmed: '确认',
        BATCH_PREFIX: '批量',
      },
    },
  },
  ORDER_STATUSES: ['pending', 'confirmed', 'rejected', 'void'],
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

import createRoutesApp from '../create.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', createRoutesApp);
  return app;
}

describe('manage order create routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createManagedOrder.mockResolvedValue({ id: 'order-1', orderNo: 'SO-1' });
    mocks.repoBatchUpdateStatus.mockResolvedValue(undefined);
    mocks.resolveSalesTokens.mockResolvedValue([]);
    mocks.scheduleOrderMutationCachesInvalidation.mockImplementation(() => {});
  });

  it('audits managed order creation', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: 'A' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'order.create',
        targetId: 'order-1',
        target_label: 'SO-1',
      })
    );
  });

  it('audits batch order status updates', async () => {
    const waitUntil = vi.fn();
    const app = createApp();
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: [{ id: 'order-1', order_no: 'SO-1', salesperson_id: null, status: 'pending' }] })),
        })),
      })),
    };

    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['order-1'], action: 'status', value: 'confirmed' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.repoBatchUpdateStatus).toHaveBeenCalledWith(
      ['order-1'],
      'confirmed',
      expect.anything(),
      { forceStatusTransition: false }
    );
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_status_changed_by_admin',
        aggregate_id: 'order-1',
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'order.batch_update',
        metadata: expect.objectContaining({ count: 1, status: 'confirmed' }),
      })
    );
  });
});
