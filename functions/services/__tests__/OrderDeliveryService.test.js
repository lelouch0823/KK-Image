import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { OrderDeliveryService } from '../OrderDeliveryService.js';

function createDbHarness({
  orderRow = {
    id: 'order-1',
    order_no: 'SO-1',
    status: 'fulfilled',
    fulfillment_status: 'fulfilled',
    delivery_status: 'in_transit',
    delivered_at: null,
    delivered_by: null,
    delivery_note: '',
    ordered_qty: 2,
    shipped_qty: 2,
    cancelled_qty: 0,
  },
} = {}) {
  const calls = {
    batchedStatements: [],
  };

  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        params: [],
        bind: vi.fn(function bindStatement(...params) {
          statement.params = params;
          return statement;
        }),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      };

      if (sql.includes('FROM orders o') && sql.includes('LEFT JOIN order_lines ol')) {
        statement.first = vi.fn(async () => orderRow);
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchedStatements.push(...statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  return { db, calls };
}

describe('OrderDeliveryService', () => {
  let harness;
  let service;

  beforeEach(() => {
    harness = createDbHarness();
    service = new OrderDeliveryService(harness.db, {
      now: () => 1710000000000,
    });
  });

  it('confirms delivery on fulfilled orders and persists confirmation metadata', async () => {
    const result = await service.confirmDelivery(
      'order-1',
      { note: 'signed by lobby desk' },
      { actorName: 'Admin' }
    );

    expect(result).toEqual({
      orderId: 'order-1',
      deliveryStatus: 'delivered',
      deliveredAt: 1710000000000,
      deliveredBy: 'Admin',
      deliveryNote: 'signed by lobby desk',
    });
    expect(harness.db.batch).toHaveBeenCalledTimes(1);
    expect(harness.calls.batchedStatements).toHaveLength(1);
    expect(harness.calls.batchedStatements[0].sql).toContain('SET delivery_status = \'delivered\'');
    expect(harness.calls.batchedStatements[0].params).toEqual([
      1710000000000,
      'Admin',
      'signed by lobby desk',
      1710000000000,
      'order-1',
    ]);
  });

  it('rejects confirmation before the order is fully fulfilled and shipped', async () => {
    harness = createDbHarness({
      orderRow: {
        id: 'order-1',
        order_no: 'SO-1',
        status: 'shipping',
        fulfillment_status: 'partially_fulfilled',
        delivery_status: 'in_transit',
        delivered_at: null,
        delivered_by: null,
        delivery_note: '',
        ordered_qty: 4,
        shipped_qty: 2,
        cancelled_qty: 0,
      },
    });
    service = new OrderDeliveryService(harness.db, {
      now: () => 1710000000000,
    });

    await expect(service.confirmDelivery('order-1', {}, { actorName: 'Admin' })).rejects.toThrow(
      new BadRequestError('delivery confirmation requires a fulfilled order with all shippable quantity shipped')
    );
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('rejects duplicate delivery confirmation for already delivered orders', async () => {
    harness = createDbHarness({
      orderRow: {
        id: 'order-1',
        order_no: 'SO-1',
        status: 'fulfilled',
        fulfillment_status: 'fulfilled',
        delivery_status: 'delivered',
        delivered_at: 1710000000000,
        delivered_by: 'Admin',
        delivery_note: 'front desk',
        ordered_qty: 2,
        shipped_qty: 2,
        cancelled_qty: 0,
      },
    });
    service = new OrderDeliveryService(harness.db, {
      now: () => 1710000000000,
    });

    await expect(service.confirmDelivery('order-1', {}, { actorName: 'Admin' })).rejects.toThrow(
      new BadRequestError('delivery is already confirmed')
    );
    expect(harness.db.batch).not.toHaveBeenCalled();
  });
});
