import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  updateStatus,
  batchUpdateStatus,
  ORDER_DELIVERED_COMPLETENESS_ERROR,
  ORDER_SHIPPED_VOID_GUARD_ERROR,
} from '../order/mutations.js';
import { OrderRepository } from '../OrderRepository.js';

function createStatement(
  sql,
  { firstResult = null, allResult = { results: [] }, runResult = { success: true, meta: { changes: 1 } } } = {}
) {
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

function createMockDb({
  singleOrder = null,
  batchOrders = [],
  variantStockById = {},
  lineSummariesByOrderId = {},
} = {}) {
  const db = {
    prepare: vi.fn((sql) => {
      if (sql.includes('ROW_NUMBER() OVER') && sql.includes('COUNT(*) OVER')) {
        const statement = createStatement(sql);
        statement.bind = vi.fn((...orderIds) => {
          statement.params = orderIds;
          statement.all = vi.fn(async () => ({
            results: orderIds
              .map((orderId) => {
                const summary = lineSummariesByOrderId[orderId] || {
                  ordered_qty: 0,
                  shipped_qty: 0,
                  cancelled_qty: 0,
                  line_count: 0,
                };

                return {
                  order_id: orderId,
                  id: `line-for-${orderId}`,
                  ordered_qty: summary.ordered_qty || 0,
                  procured_qty: summary.ordered_qty || 0,
                  received_qty: summary.ordered_qty || 0,
                  reserved_qty: 0,
                  shipped_qty: summary.shipped_qty || 0,
                  cancelled_qty: summary.cancelled_qty || 0,
                  line_count: summary.line_count || 0,
                  total_ordered_qty: summary.ordered_qty || 0,
                  total_shipped_qty: summary.shipped_qty || 0,
                  total_cancelled_qty: summary.cancelled_qty || 0,
                  row_num: 1,
                };
              })
              .filter((row) => row.line_count > 0),
          }));
          return statement;
        });
        return statement;
      }
      if (sql.includes('COALESCE(SUM(ordered_qty), 0) AS ordered_qty')) {
        const statement = createStatement(sql);
        statement.bind = vi.fn((orderId) => {
          statement.params = [orderId];
          statement.first = vi.fn(
            async () =>
              lineSummariesByOrderId[orderId] || {
                ordered_qty: 0,
                shipped_qty: 0,
                cancelled_qty: 0,
                line_count: 0,
              }
          );
          return statement;
        });
        return statement;
      }
      if (
        sql.includes('SELECT status, variant_id, quantity') &&
        sql.includes('FROM orders WHERE id = ?')
      ) {
        return createStatement(sql, { firstResult: singleOrder });
      }
      if (sql.includes('SELECT id FROM order_lines WHERE order_id = ?')) {
        return createStatement(sql, {
          firstResult: { id: `line-for-${singleOrder?.id || 'order'}` },
        });
      }
      if (
        sql.includes('SELECT id, status, variant_id, quantity') &&
        sql.includes('FROM orders WHERE id IN')
      ) {
        return createStatement(sql, { allResult: { results: batchOrders } });
      }
      if (sql.includes('SELECT stock_quantity FROM product_variants WHERE id = ?')) {
        const statement = createStatement(sql);
        statement.bind = vi.fn((variantId) => {
          statement.params = [variantId];
          const stock = variantStockById[variantId];
          statement.first = vi.fn(async () =>
            stock === undefined ? null : { stock_quantity: stock }
          );
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

  it('does not deduct variant stock when status changes to delivered after all line quantities are shipped', async () => {
    const db = createMockDb({
      singleOrder: { status: 'arrived', variant_id: 'v-1', quantity: 3 },
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 3, shipped_qty: 3, cancelled_qty: 0, line_count: 1 },
      },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'delivered', 'admin', { inventoryService });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyMutation).not.toHaveBeenCalled();
  });

  it('rejects void transition when any line still has shipped quantity', async () => {
    const db = createMockDb({
      singleOrder: { status: 'delivered', variant_id: 'v-1', quantity: 2 },
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 2, shipped_qty: 2, cancelled_qty: 0, line_count: 1 },
      },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await expect(updateStatus(db, 'o-1', 'void', 'admin', { inventoryService })).rejects.toThrow(
      ORDER_SHIPPED_VOID_GUARD_ERROR
    );
    expect(db.batch).not.toHaveBeenCalled();
    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyMutation).not.toHaveBeenCalled();
  });

  it('does not adjust stock for non-delivery transitions', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
    });

    await updateStatus(db, 'o-1', 'confirmed', 'admin');

    expect(db.batch).toHaveBeenCalledTimes(1);
    const stockUpdateCalls = db.prepare.mock.calls.filter(([sql]) =>
      sql.includes('UPDATE product_variants')
    );
    expect(stockUpdateCalls).toHaveLength(0);
  });

  it('batch delivered transition does not apply inventory mutations when lines are already fully shipped', async () => {
    const db = createMockDb({
      batchOrders: [
        { id: 'o-1', status: 'arrived', variant_id: 'v-1', quantity: 4 },
        { id: 'o-2', status: 'arrived', variant_id: 'v-2', quantity: 6 },
      ],
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 4, shipped_qty: 4, cancelled_qty: 0, line_count: 1 },
        'o-2': { ordered_qty: 6, shipped_qty: 6, cancelled_qty: 0, line_count: 1 },
      },
    });
    const timelineRepo = {
      createInsertStatement: vi.fn(() => null),
    };
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyBatch: vi.fn(async () => ({ productCount: 1, totalQty: 4 })),
    };

    await batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'delivered', undefined, {
      inventoryService,
    });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyBatch).not.toHaveBeenCalled();
  });

  it('rejects delivered transition when any line quantity is not yet shipped', async () => {
    const db = createMockDb({
      singleOrder: { status: 'arrived', variant_id: 'v-1', quantity: 3 },
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 3, shipped_qty: 2, cancelled_qty: 0, line_count: 1 },
      },
    });

    await expect(updateStatus(db, 'o-1', 'delivered', 'admin')).rejects.toThrow(
      ORDER_DELIVERED_COMPLETENESS_ERROR
    );
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('rejects batch delivered transition when any order has incomplete shipped quantity', async () => {
    const db = createMockDb({
      batchOrders: [
        { id: 'o-1', status: 'arrived', variant_id: 'v-1', quantity: 5 },
        { id: 'o-2', status: 'arrived', variant_id: 'v-2', quantity: 1 },
      ],
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 5, shipped_qty: 4, cancelled_qty: 0, line_count: 1 },
        'o-2': { ordered_qty: 1, shipped_qty: 1, cancelled_qty: 0, line_count: 1 },
      },
    });
    const timelineRepo = {
      createInsertStatement: vi.fn(() => null),
    };

    await expect(batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'delivered')).rejects.toThrow(
      ORDER_DELIVERED_COMPLETENESS_ERROR
    );
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('rejects out-of-flow transition without force override', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
      variantStockById: { 'v-1': 10 },
    });

    await expect(updateStatus(db, 'o-1', 'delivered', 'admin')).rejects.toThrow(
      /invalid order status transition/i
    );
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('allows out-of-flow transition with force override', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 2, shipped_qty: 2, cancelled_qty: 0, line_count: 1 },
      },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'delivered', 'admin', {
      forceStatusTransition: true,
      inventoryService,
    });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(inventoryService.applyMutation).not.toHaveBeenCalled();
  });

  it('does not route delivered transitions through InventoryService stock checks or mutations', async () => {
    const db = createMockDb({
      singleOrder: { status: 'arrived', variant_id: 'v-1', quantity: 3 },
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 3, shipped_qty: 3, cancelled_qty: 0, line_count: 1 },
      },
    });
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };

    await updateStatus(db, 'o-1', 'delivered', 'admin', { inventoryService });

    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyMutation).not.toHaveBeenCalled();
    const stockUpdateCalls = db.prepare.mock.calls.filter(([sql]) =>
      sql.includes('UPDATE product_variants')
    );
    expect(stockUpdateCalls).toHaveLength(0);
  });

  it('does not route batch delivered transitions through InventoryService aggregation', async () => {
    const db = createMockDb({
      batchOrders: [
        { id: 'o-1', status: 'arrived', variant_id: 'v-1', quantity: 2 },
        { id: 'o-2', status: 'arrived', variant_id: 'v-2', quantity: 4 },
      ],
      lineSummariesByOrderId: {
        'o-1': { ordered_qty: 2, shipped_qty: 2, cancelled_qty: 0, line_count: 1 },
        'o-2': { ordered_qty: 4, shipped_qty: 4, cancelled_qty: 0, line_count: 1 },
      },
    });
    const timelineRepo = {
      createInsertStatement: vi.fn(() => null),
    };
    const inventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyBatch: vi.fn(async () => ({ productCount: 2, totalQty: 6 })),
    };

    await batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'delivered', undefined, {
      inventoryService,
    });

    expect(inventoryService.assertSufficient).not.toHaveBeenCalled();
    expect(inventoryService.applyBatch).not.toHaveBeenCalled();
    const stockUpdateCalls = db.prepare.mock.calls.filter(([sql]) =>
      sql.includes('UPDATE product_variants')
    );
    expect(stockUpdateCalls).toHaveLength(0);
  });

  it('OrderRepository passes InventoryService into status mutations', async () => {
    const db = { prepare: vi.fn(), batch: vi.fn() };
    const mockInventoryService = {
      assertSufficient: vi.fn(async () => true),
      applyMutation: vi.fn(async () => true),
    };
    const repo = new OrderRepository(db, {
      InventoryServiceFactory: () => mockInventoryService,
    });
    vi.spyOn(db, 'prepare').mockImplementation((sql) => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: sql.includes('ROW_NUMBER() OVER')
            ? [
                {
                  order_id: 'o-1',
                  id: 'line-for-order',
                  ordered_qty: 1,
                  procured_qty: 1,
                  received_qty: 1,
                  reserved_qty: 0,
                  shipped_qty: 1,
                  cancelled_qty: 0,
                  line_count: 1,
                  total_ordered_qty: 1,
                  total_shipped_qty: 1,
                  total_cancelled_qty: 0,
                  row_num: 1,
                },
              ]
            : [],
        })),
        first: vi.fn(async () => ({ status: 'arrived', variant_id: 'v-1', quantity: 1 })),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      })),
    }));
    db.batch.mockResolvedValue([]);

    await repo.updateStatus('o-1', 'delivered', 'admin', { forceStatusTransition: true });

    expect(mockInventoryService.applyMutation).not.toHaveBeenCalled();
  });
});
