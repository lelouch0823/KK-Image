import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderFindById: vi.fn(),
  orderFindActiveById: vi.fn(),
  orderAddTimelineEntry: vi.fn(),
  paymentFindByOrder: vi.fn(),
  paymentGetTotalPaid: vi.fn(),
  paymentGetOrderAmount: vi.fn(),
  paymentGetPaymentSummary: vi.fn(),
  paymentCreate: vi.fn(),
  paymentCreateIfWithinRemaining: vi.fn(),
  paymentCreateRefundIfWithinPaid: vi.fn(),
  paymentDelete: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.orderFindById,
    findActiveById: mocks.orderFindActiveById,
    timelineRepo: { addTimelineEntry: mocks.orderAddTimelineEntry },
  })),
}));

vi.mock('../../../../../../repositories/PaymentRepository.js', () => ({
  PaymentRepository: vi.fn(() => ({
    findByOrder: mocks.paymentFindByOrder,
    getTotalPaid: mocks.paymentGetTotalPaid,
    getOrderAmount: mocks.paymentGetOrderAmount,
    getPaymentSummary: mocks.paymentGetPaymentSummary,
    create: mocks.paymentCreate,
    createIfWithinRemaining: mocks.paymentCreateIfWithinRemaining,
    createRefundIfWithinPaid: mocks.paymentCreateRefundIfWithinPaid,
    delete: mocks.paymentDelete,
  })),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import paymentsApp from '../payments.js';

// 幂等命令依赖 command_idempotency 表读写：提供支持
// SELECT（未命中）/ INSERT（预留）/ UPDATE（提交）链的最小 DB mock
function createDbMock() {
  return {
    prepare: vi.fn(() => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => ({ results: [] })),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      };
      return statement;
    }),
    batch: vi.fn(async () => []),
  };
}

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
  app.route('/api/manage/orders', paymentsApp);
  return app;
}

describe('manage order payment routes', () => {
  let app;
  let db;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    db = createDbMock();
    mocks.orderFindById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'confirmed',
      quantity: 2,
    });
    mocks.orderFindActiveById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      status: 'confirmed',
      quantity: 2,
    });
    mocks.orderAddTimelineEntry.mockResolvedValue(true);
    mocks.paymentFindByOrder.mockResolvedValue([]);
    mocks.paymentGetTotalPaid.mockResolvedValue(40);
    mocks.paymentGetOrderAmount.mockResolvedValue(200);
    mocks.paymentGetPaymentSummary.mockResolvedValue({
      paid: 40,
      refunded: 0,
      netPaid: 40,
    });
    mocks.paymentCreate.mockResolvedValue({ id: 'pay-1', amount: 150 });
    mocks.paymentCreateIfWithinRemaining.mockResolvedValue({
      id: 'pay-1',
      amount: 150,
      type: 'payment',
    });
    mocks.paymentCreateRefundIfWithinPaid.mockResolvedValue({
      id: 'refund-1',
      amount: -30,
      type: 'refund',
    });
    mocks.paymentDelete.mockResolvedValue(true);
  });

  it('summarizes receivable amount from order monetary total instead of order quantity', async () => {
    const response = await app.request('/api/manage/orders/order-1/payments', {}, { DB: db });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.paymentGetOrderAmount).toHaveBeenCalledWith('order-1');
    expect(mocks.paymentGetPaymentSummary).toHaveBeenCalledWith('order-1');
    expect(payload.data.summary).toEqual({
      orderAmount: 200,
      totalPaid: 40,
      paid: 40,
      refunded: 0,
      outstanding: 160,
    });
  });

  it('uses monetary remaining amount when accepting new payments', async () => {
    const response = await app.request(
      '/api/manage/orders/order-1/payments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-pay-1' },
        body: JSON.stringify({ amount: 150, method: 'cash' }),
      },
      { DB: db }
    );

    expect(response.status).toBe(200);
    expect(mocks.paymentCreateIfWithinRemaining).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        amount: 150,
      })
    );
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    // 资金类命令必须写审计与时间轴
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.payment.create' })
    );
    expect(mocks.orderAddTimelineEntry).toHaveBeenCalled();
  });

  it('rejects when the atomic payment insert detects a stale remaining balance', async () => {
    mocks.paymentCreateIfWithinRemaining.mockResolvedValueOnce(null);

    const response = await app.request(
      '/api/manage/orders/order-1/payments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-pay-1' },
        body: JSON.stringify({ amount: 150, method: 'cash' }),
      },
      { DB: db }
    );

    expect(response.status).toBe(400);
    expect(mocks.paymentCreateIfWithinRemaining).toHaveBeenCalledTimes(1);
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it('rejects refund exceeding refundable net amount', async () => {
    mocks.paymentCreateRefundIfWithinPaid.mockResolvedValueOnce(null);

    const response = await app.request(
      '/api/manage/orders/order-1/refunds',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-refund-1' },
        body: JSON.stringify({ amount: 999, method: 'cash' }),
      },
      { DB: db }
    );

    expect(response.status).toBe(400);
    expect(mocks.paymentCreateRefundIfWithinPaid).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', amount: 999 })
    );
  });

  it('records refund with audit and timeline on success', async () => {
    const response = await app.request(
      '/api/manage/orders/order-1/refunds',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-refund-1' },
        body: JSON.stringify({ amount: 30, method: 'bank' }),
      },
      { DB: db }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.type).toBe('refund');
    expect(payload.data.amount).toBe(-30);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.payment.refund', severity: 'high' })
    );
    expect(mocks.orderAddTimelineEntry).toHaveBeenCalled();
  });

  it('does not return payment data for archived orders', async () => {
    mocks.orderFindById.mockResolvedValueOnce({
      id: 'order-archived',
      status: 'confirmed',
      archivedAt: 1710000000000,
    });
    mocks.orderFindActiveById.mockResolvedValueOnce(null);

    const response = await app.request('/api/manage/orders/order-archived/payments', {}, { DB: db });

    expect(response.status).toBe(404);
    expect(mocks.orderFindActiveById).toHaveBeenCalledWith('order-archived');
    expect(mocks.orderFindById).not.toHaveBeenCalled();
    expect(mocks.paymentFindByOrder).not.toHaveBeenCalled();
    expect(mocks.paymentGetTotalPaid).not.toHaveBeenCalled();
    expect(mocks.paymentGetOrderAmount).not.toHaveBeenCalled();
  });

  it('rejects creating payments on archived orders', async () => {
    mocks.orderFindById.mockResolvedValueOnce({
      id: 'order-1',
      status: 'confirmed',
      archivedAt: 1710000000000,
    });

    const response = await app.request(
      '/api/manage/orders/order-1/payments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-pay-1' },
        body: JSON.stringify({ amount: 50, method: 'cash' }),
      },
      { DB: db }
    );

    expect(response.status).toBe(400);
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(mocks.paymentCreateIfWithinRemaining).not.toHaveBeenCalled();
  });

  it('deletes payment scoped to the order and writes audit', async () => {
    const response = await app.request(
      '/api/manage/orders/order-1/payments/pay-1',
      { method: 'DELETE' },
      { DB: db }
    );

    expect(response.status).toBe(200);
    expect(mocks.paymentDelete).toHaveBeenCalledWith('pay-1', 'order-1');
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'order.payment.delete' })
    );
  });

  it('returns 404 when the payment does not belong to the order', async () => {
    mocks.paymentDelete.mockResolvedValueOnce(false);

    const response = await app.request(
      '/api/manage/orders/order-1/payments/pay-404',
      { method: 'DELETE' },
      { DB: db }
    );

    expect(response.status).toBe(404);
  });
});
