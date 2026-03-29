import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateStatus, batchUpdateStatus } from '../order/mutations.js';
import { OrderRepository } from '../OrderRepository.js';

function createStatement(sql, { firstResult = null, allResult = { results: [] }, runResult = { success: true } } = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => firstResult),
    all: vi.fn(async () => allResult),
    run: vi.fn(async () => runResult),
  };
  return statement;
}

function createMockDb({ singleOrder = null, batchOrders = [], variantStockById = {} } = {}) {
  const db = {
    prepare: vi.fn((sql) => {
      if (sql.includes('SELECT status, variant_id, quantity FROM orders WHERE id = ?')) {
        return createStatement(sql, { firstResult: singleOrder });
      }
      if (sql.includes('SELECT id FROM order_lines WHERE order_id = ?')) {
        return createStatement(sql, { firstResult: { id: `line-for-${singleOrder?.id || 'order'}` } });
      }
      if (sql.includes('SELECT id, status, variant_id, quantity FROM orders WHERE id IN')) {
        return createStatement(sql, { allResult: { results: batchOrders } });
      }
      if (sql.includes('SELECT stock_quantity FROM product_variants WHERE id = ?')) {
        const statement = createStatement(sql);
        statement.bind = vi.fn((variantId) => {
          statement.params = [variantId];
          const stock = variantStockById[variantId];
          statement.first = vi.fn(async () => (stock === undefined ? null : { stock_quantity: stock }));
          return statement;
        });
        return statement;
      }
      return createStatement(sql);
    }),
    batch: vi.fn(async () => []),
  };
  return db;
}

describe('order inventory flow on status transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts variant stock when status changes to delivered', async () => {
    const db = createMockDb({
      singleOrder: { status: 'arrived', variant_id: 'v-1', quantity: 3 },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'delivered', 'admin', { inventoryService });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.assertSufficient).toHaveBeenCalledWith('v-1', 3);
    expect(inventoryService.applyMutation).toHaveBeenCalledWith({
      type: 'order_shipment',
      variantId: 'v-1',
      quantityDelta: -3,
      orderId: 'o-1',
      orderLineId: 'line-for-order',
      referenceType: 'order',
      referenceId: 'o-1',
    });
  });

  it('restores variant stock when status moves away from delivered', async () => {
    const db = createMockDb({
      singleOrder: { status: 'delivered', variant_id: 'v-1', quantity: 2 },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'void', 'admin', { inventoryService });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyMutation).toHaveBeenCalledWith({
      type: 'order_shipment',
      variantId: 'v-1',
      quantityDelta: 2,
      orderId: 'o-1',
      orderLineId: 'line-for-order',
      referenceType: 'order',
      referenceId: 'o-1',
    });
  });

  it('does not adjust stock for non-delivery transitions', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
    });

    await updateStatus(db, 'o-1', 'confirmed', 'admin');

    expect(db.batch).toHaveBeenCalledTimes(1);
    const stockUpdateCalls = db.prepare.mock.calls.filter(([sql]) => sql.includes('UPDATE product_variants'));
    expect(stockUpdateCalls).toHaveLength(0);
  });

  it('batch status update applies stock adjustment only for delivery transition rows', async () => {
    const db = createMockDb({
      batchOrders: [
        { id: 'o-1', status: 'delivered', variant_id: 'v-1', quantity: 4 },
        { id: 'o-2', status: 'pending', variant_id: 'v-2', quantity: 6 },
      ],
    });
    const timelineRepo = {
      createInsertStatement: vi.fn(() => null),
    };
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyBatch: vi.fn(async () => ({ productCount: 1, totalQty: 4 })),
    };

    await batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'void', undefined, { inventoryService });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyBatch).toHaveBeenCalledWith([
      { type: 'order_shipment', variantId: 'v-1', quantityDelta: 4, orderId: 'o-1', referenceType: 'order', referenceId: 'o-1' },
    ]);
  });

  it('rejects delivered transition when variant stock is lower than order quantity', async () => {
    const db = createMockDb({
      singleOrder: { status: 'arrived', variant_id: 'v-1', quantity: 3 },
      variantStockById: { 'v-1': 2 },
    });

    await expect(updateStatus(db, 'o-1', 'delivered', 'admin'))
      .rejects.toThrow(/insufficient variant stock/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('rejects batch status update when any delivered transition is short on stock', async () => {
    const db = createMockDb({
      batchOrders: [
        { id: 'o-1', status: 'arrived', variant_id: 'v-1', quantity: 5 },
        { id: 'o-2', status: 'arrived', variant_id: 'v-2', quantity: 1 },
      ],
      variantStockById: { 'v-1': 4, 'v-2': 10 },
    });
    const timelineRepo = {
      createInsertStatement: vi.fn(() => null),
    };

    await expect(batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'delivered'))
      .rejects.toThrow(/insufficient variant stock/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('rejects out-of-flow transition without force override', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
      variantStockById: { 'v-1': 10 },
    });

    await expect(updateStatus(db, 'o-1', 'delivered', 'admin'))
      .rejects.toThrow(/invalid order status transition/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('allows out-of-flow transition with force override', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'delivered', 'admin', { forceStatusTransition: true, inventoryService });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.applyMutation).toHaveBeenCalledWith({
      type: 'order_shipment',
      variantId: 'v-1',
      quantityDelta: -2,
      orderId: 'o-1',
      orderLineId: 'line-for-order',
      referenceType: 'order',
      referenceId: 'o-1',
    });
  });

  it('routes delivery stock checks and mutations through InventoryService', async () => {
    const db = createMockDb({
      singleOrder: { status: 'arrived', variant_id: 'v-1', quantity: 3 },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'delivered', 'admin', { inventoryService });

    expect(inventoryService.assertSufficient).toHaveBeenCalledWith('v-1', 3);
    expect(inventoryService.applyMutation).toHaveBeenCalledWith({
      type: 'order_shipment',
      variantId: 'v-1',
      quantityDelta: -3,
      orderId: 'o-1',
      orderLineId: 'line-for-order',
      referenceType: 'order',
      referenceId: 'o-1',
    });
    const stockUpdateCalls = db.prepare.mock.calls.filter(([sql]) => sql.includes('UPDATE product_variants'));
    expect(stockUpdateCalls).toHaveLength(0);
  });

  it('routes batch delivery mutations through InventoryService aggregation', async () => {
    const db = createMockDb({
      batchOrders: [
        { id: 'o-1', status: 'arrived', variant_id: 'v-1', quantity: 2 },
        { id: 'o-2', status: 'arrived', variant_id: 'v-2', quantity: 4 },
      ],
    });
    const timelineRepo = {
      createInsertStatement: vi.fn(() => null),
    };
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyBatch: vi.fn(async () => ({ productCount: 2, totalQty: 6 })),
    };

    await batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'delivered', undefined, { inventoryService });

    expect(inventoryService.assertSufficient).toHaveBeenNthCalledWith(1, 'v-1', 2);
    expect(inventoryService.assertSufficient).toHaveBeenNthCalledWith(2, 'v-2', 4);
    expect(inventoryService.applyBatch).toHaveBeenCalledWith([
      { type: 'order_shipment', variantId: 'v-1', quantityDelta: -2, orderId: 'o-1', referenceType: 'order', referenceId: 'o-1' },
      { type: 'order_shipment', variantId: 'v-2', quantityDelta: -4, orderId: 'o-2', referenceType: 'order', referenceId: 'o-2' },
    ]);
    const stockUpdateCalls = db.prepare.mock.calls.filter(([sql]) => sql.includes('UPDATE product_variants'));
    expect(stockUpdateCalls).toHaveLength(0);
  });

  it('OrderRepository passes InventoryService into status mutations', async () => {
    const db = { prepare: vi.fn(), batch: vi.fn() };
    const repo = new OrderRepository(db);
    repo.inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };
    vi.spyOn(db, 'prepare').mockImplementation((sql) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => (
          sql.includes('SELECT id FROM order_lines WHERE order_id = ?')
            ? { id: 'line-for-order' }
            : { status: 'arrived', variant_id: 'v-1', quantity: 1 }
        )),
        run: vi.fn(async () => ({ success: true })),
      })),
    }));
    db.batch.mockResolvedValue([]);

    await repo.updateStatus('o-1', 'delivered', 'admin', { forceStatusTransition: true });

    expect(repo.inventoryService.applyMutation).toHaveBeenCalledWith({
      type: 'order_shipment',
      variantId: 'v-1',
      quantityDelta: -1,
      orderId: 'o-1',
      orderLineId: 'line-for-order',
      referenceType: 'order',
      referenceId: 'o-1',
    });
  });
});
