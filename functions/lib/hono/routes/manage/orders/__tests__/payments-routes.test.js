import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderFindById: vi.fn(),
  orderFindActiveById: vi.fn(),
  paymentFindByOrder: vi.fn(),
  paymentGetTotalPaid: vi.fn(),
  paymentGetOrderAmount: vi.fn(),
  paymentCreate: vi.fn(),
  paymentCreateIfWithinRemaining: vi.fn(),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.orderFindById,
    findActiveById: mocks.orderFindActiveById,
  })),
}));

vi.mock('../../../../../../repositories/PaymentRepository.js', () => ({
  PaymentRepository: vi.fn(() => ({
    findByOrder: mocks.paymentFindByOrder,
    getTotalPaid: mocks.paymentGetTotalPaid,
    getOrderAmount: mocks.paymentGetOrderAmount,
    create: mocks.paymentCreate,
    createIfWithinRemaining: mocks.paymentCreateIfWithinRemaining,
  })),
}));

import paymentsApp from '../payments.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1' });
    await next();
  });
  app.route('/api/manage/orders', paymentsApp);
  return app;
}

describe('manage order payment routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mocks.orderFindById.mockResolvedValue({
      id: 'order-1',
      status: 'confirmed',
      quantity: 2,
    });
    mocks.orderFindActiveById.mockResolvedValue({
      id: 'order-1',
      status: 'confirmed',
      quantity: 2,
    });
    mocks.paymentFindByOrder.mockResolvedValue([]);
    mocks.paymentGetTotalPaid.mockResolvedValue(40);
    mocks.paymentGetOrderAmount.mockResolvedValue(200);
    mocks.paymentCreate.mockResolvedValue({ id: 'pay-1', amount: 150 });
    mocks.paymentCreateIfWithinRemaining.mockResolvedValue({ id: 'pay-1', amount: 150 });
  });

  it('summarizes receivable amount from order monetary total instead of order quantity', async () => {
    const response = await app.request('/api/manage/orders/order-1/payments', {}, { DB: {} });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.paymentGetOrderAmount).toHaveBeenCalledWith('order-1');
    expect(payload.data.summary).toEqual({
      orderAmount: 200,
      totalPaid: 40,
      outstanding: 160,
    });
  });

  it('uses monetary remaining amount when accepting new payments', async () => {
    const response = await app.request(
      '/api/manage/orders/order-1/payments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 150, method: 'cash' }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(200);
    expect(mocks.paymentCreateIfWithinRemaining).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        amount: 150,
      })
    );
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it('rejects when the atomic payment insert detects a stale remaining balance', async () => {
    mocks.paymentCreateIfWithinRemaining.mockResolvedValueOnce(null);

    const response = await app.request(
      '/api/manage/orders/order-1/payments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 150, method: 'cash' }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(400);
    expect(mocks.paymentCreateIfWithinRemaining).toHaveBeenCalledTimes(1);
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it('does not return payment data for archived orders', async () => {
    mocks.orderFindById.mockResolvedValueOnce({
      id: 'order-archived',
      status: 'confirmed',
      archivedAt: 1710000000000,
    });
    mocks.orderFindActiveById.mockResolvedValueOnce(null);

    const response = await app.request('/api/manage/orders/order-archived/payments', {}, { DB: {} });

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 50, method: 'cash' }),
      },
      { DB: {} }
    );

    expect(response.status).toBe(400);
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(mocks.paymentCreateIfWithinRemaining).not.toHaveBeenCalled();
  });
});
