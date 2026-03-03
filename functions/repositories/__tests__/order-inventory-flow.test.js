import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateStatus, batchUpdateStatus } from '../order/mutations.js';

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
      variantStockById: { 'v-1': 10 },
    });

    await updateStatus(db, 'o-1', 'delivered', 'admin');

    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    const stockStmt = statements.find((stmt) => stmt.sql.includes('UPDATE product_variants'));
    expect(stockStmt).toBeDefined();
    expect(stockStmt.params[0]).toBe(-3);
    expect(stockStmt.params[2]).toBe('v-1');
  });

  it('restores variant stock when status moves away from delivered', async () => {
    const db = createMockDb({
      singleOrder: { status: 'delivered', variant_id: 'v-1', quantity: 2 },
    });

    await updateStatus(db, 'o-1', 'void', 'admin');

    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    const stockStmt = statements.find((stmt) => stmt.sql.includes('UPDATE product_variants'));
    expect(stockStmt).toBeDefined();
    expect(stockStmt.params[0]).toBe(2);
    expect(stockStmt.params[2]).toBe('v-1');
  });

  it('does not adjust stock for non-delivery transitions', async () => {
    const db = createMockDb({
      singleOrder: { status: 'pending', variant_id: 'v-1', quantity: 2 },
    });

    await updateStatus(db, 'o-1', 'confirmed', 'admin');

    expect(db.batch).not.toHaveBeenCalled();
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

    await batchUpdateStatus(db, timelineRepo, ['o-1', 'o-2'], 'void');

    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    const stockStatements = statements.filter((stmt) => stmt.sql.includes('UPDATE product_variants'));
    expect(stockStatements).toHaveLength(1);
    expect(stockStatements[0].params[0]).toBe(4);
    expect(stockStatements[0].params[2]).toBe('v-1');
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
      variantStockById: { 'v-1': 10 },
    });

    await updateStatus(db, 'o-1', 'delivered', 'admin', { forceStatusTransition: true });

    expect(db.batch).toHaveBeenCalledTimes(1);
  });
});
