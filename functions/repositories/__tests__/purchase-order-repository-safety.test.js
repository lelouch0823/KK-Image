import { describe, it, expect, vi } from 'vitest';
import { PurchaseOrderRepository } from '../PurchaseOrderRepository.js';

function createDb(changes = 1) {
  const run = vi.fn(async () => ({ meta: { changes } }));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare, __bind: bind, __run: run };
}

function createBatchDb() {
  const run = vi.fn(async () => ({ meta: { changes: 1 } }));
  const prepare = vi.fn((sql) => ({
    sql,
    bind: (...params) => ({
      sql,
      params,
      run,
    }),
  }));
  const batch = vi.fn(async () => []);
  return { prepare, batch, __run: run };
}

function createFailingBatchDb({ failOnBatchCall = 2 } = {}) {
  const runStatements = [];
  const prepare = vi.fn((sql) => ({
    sql,
    bind: (...params) => ({
      sql,
      params,
      run: vi.fn(async () => {
        runStatements.push({ sql, params });
        return { meta: { changes: 1 } };
      }),
    }),
  }));
  let batchCall = 0;
  const batch = vi.fn(async (stmts) => {
    batchCall += 1;
    if (batchCall === failOnBatchCall) {
      throw new Error('batch failed');
    }
    return stmts.map(() => ({ meta: { changes: 1 } }));
  });
  return { prepare, batch, __runStatements: runStatements };
}

function createHeaderFailureDb() {
  const runStatements = [];
  let updateCallCount = 0;
  const prepare = vi.fn((sql) => ({
    sql,
    bind: (...params) => ({
      sql,
      params,
      run: vi.fn(async () => {
        runStatements.push({ sql, params });
        if (sql.includes('UPDATE purchase_orders SET updated_at = ?')) {
          updateCallCount += 1;
          throw new Error('header update failed');
        }
        return { meta: { changes: 1 } };
      }),
    }),
  }));
  const batch = vi.fn(async (stmts) => stmts.map(() => ({ meta: { changes: 1 } })));
  return { prepare, batch, __runStatements: runStatements, __updateCallCount: () => updateCallCount };
}

function createScopedMutationDb(batchChanges = [1, 1]) {
  const batchCalls = [];
  const prepare = vi.fn((sql) => ({
    sql,
    bind: (...params) => ({
      sql,
      params,
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
    }),
  }));
  const batch = vi.fn(async (stmts) => {
    batchCalls.push(stmts);
    return batchChanges.map((changes) => ({ meta: { changes } }));
  });
  return { prepare, batch, __batchCalls: batchCalls };
}

describe('PurchaseOrderRepository safety guards', () => {
  it('generatePoNo increments from the highest daily suffix instead of row count', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-30T04:00:00.000Z'));

      const first = vi.fn(async () => ({ po_no: 'PO-20260330-009' }));
      const db = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({ first })),
        })),
      };
      const repo = new PurchaseOrderRepository(db);

      await expect(repo.generatePoNo()).resolves.toBe('PO-20260330-010');
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries purchase-order number allocation when a concurrent insert wins the same po_no', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-30T04:00:00.000Z'));

      const first = vi.fn()
        .mockResolvedValueOnce({ po_no: 'PO-20260330-001' })
        .mockResolvedValueOnce({ po_no: 'PO-20260330-002' });
      const run = vi.fn()
        .mockRejectedValueOnce(new Error('D1_ERROR: UNIQUE constraint failed: purchase_orders.po_no: SQLITE_CONSTRAINT'))
        .mockResolvedValueOnce({ meta: { changes: 1 } });
      const insertParams = [];
      const db = {
        prepare: vi.fn((sql) => {
          if (sql.includes('SELECT po_no')) {
            return {
              bind: vi.fn(() => ({ first })),
            };
          }

          if (sql.includes('INSERT INTO purchase_orders')) {
            return {
              bind: vi.fn((...params) => {
                insertParams.push(params);
                return { run };
              }),
            };
          }

          throw new Error(`Unexpected SQL: ${sql}`);
        }),
      };
      const repo = new PurchaseOrderRepository(db);

      const created = await repo.create({ remark: 'concurrency retry' });

      expect(insertParams).toHaveLength(2);
      expect(insertParams[0][1]).toBe('PO-20260330-002');
      expect(insertParams[1][1]).toBe('PO-20260330-003');
      expect(created.po_no).toBe('PO-20260330-003');
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateStatusIfCurrent only updates when current status matches', async () => {
    const dbFail = createDb(0);
    const repoFail = new PurchaseOrderRepository(dbFail);
    const okFail = await repoFail.updateStatusIfCurrent('po-1', 'draft', 'ordered');
    expect(okFail).toBe(false);

    const sql = dbFail.prepare.mock.calls[0][0];
    expect(sql).toContain('WHERE id = ? AND status = ?');

    const dbPass = createDb(1);
    const repoPass = new PurchaseOrderRepository(dbPass);
    const okPass = await repoPass.updateStatusIfCurrent('po-1', 'draft', 'ordered');
    expect(okPass).toBe(true);
  });

  it('updateStatusIfCurrent clears completed_at when rolling back from completed', async () => {
    const db = createDb(1);
    const repo = new PurchaseOrderRepository(db);

    const ok = await repo.updateStatusIfCurrent('po-1', 'completed', 'arrived');

    expect(ok).toBe(true);
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('completed_at = NULL');
  });

  it('removeItem must be scoped by po_id', async () => {
    const db = createScopedMutationDb();
    const repo = new PurchaseOrderRepository(db);

    await repo.removeItem('po-1', 'item-1');

    expect(db.__batchCalls[0][0].sql).toContain('WHERE id = ? AND po_id = ?');
    expect(db.__batchCalls[0][1].sql).toContain('UPDATE purchase_orders SET updated_at = ? WHERE id = ?');
  });

  it('updateItem must be scoped by po_id', async () => {
    const db = createScopedMutationDb();
    const repo = new PurchaseOrderRepository(db);

    await repo.updateItem('po-1', 'item-1', { quantity: 2 });

    expect(db.__batchCalls[0][0].sql).toContain('WHERE id = ? AND po_id = ?');
    expect(db.__batchCalls[0][1].sql).toContain('UPDATE purchase_orders SET updated_at = ? WHERE id = ?');
  });

  it('addItems batches large inserts into D1-safe chunks', async () => {
    const db = createBatchDb();
    const repo = new PurchaseOrderRepository(db);
    const items = Array.from({ length: 105 }, (_, index) => ({
      product_id: `prod-${index + 1}`,
      variant_id: `var-${index + 1}`,
      quantity: 1,
      unit_cost: 10,
    }));

    await repo.addItems('po-1', items);

    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(db.batch.mock.calls[0][0]).toHaveLength(100);
    expect(db.batch.mock.calls[1][0]).toHaveLength(5);
  });

  it('addItems rolls back previously inserted chunks when a later batch chunk fails', async () => {
    const db = createFailingBatchDb();
    const repo = new PurchaseOrderRepository(db);
    const items = Array.from({ length: 105 }, (_, index) => ({
      product_id: `prod-${index + 1}`,
      variant_id: `var-${index + 1}`,
      quantity: 1,
      unit_cost: 10,
    }));

    await expect(repo.addItems('po-1', items)).rejects.toThrow('batch failed');

    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(
      db.__runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM purchase_order_items WHERE id IN')
      )
    ).toBe(true);
    expect(
      db.__runStatements.some((statement) =>
        statement.sql.includes('UPDATE purchase_orders SET updated_at = ?')
      )
    ).toBe(false);
  });

  it('addItems rolls back inserted items when the purchase-order timestamp refresh fails afterwards', async () => {
    const db = createHeaderFailureDb();
    const repo = new PurchaseOrderRepository(db);
    const items = Array.from({ length: 2 }, (_, index) => ({
      product_id: `prod-${index + 1}`,
      variant_id: `var-${index + 1}`,
      quantity: 1,
      unit_cost: 10,
    }));

    await expect(repo.addItems('po-1', items)).rejects.toThrow('header update failed');

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(
      db.__runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM purchase_order_items WHERE id IN')
      )
    ).toBe(true);
    expect(db.__updateCallCount()).toBe(1);
  });

  it('updateAllocations batches large updates into D1-safe chunks', async () => {
    const db = createBatchDb();
    const repo = new PurchaseOrderRepository(db);
    const allocations = Array.from({ length: 105 }, (_, index) => ({
      id: `poi-${index + 1}`,
      allocated_freight: 1,
      allocated_tariff: 2,
    }));

    await repo.updateAllocations(allocations);

    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(db.batch.mock.calls[0][0]).toHaveLength(100);
    expect(db.batch.mock.calls[1][0]).toHaveLength(5);
  });

  it('updateItem batches the line mutation and header timestamp refresh together when scoped by po_id', async () => {
    const db = createScopedMutationDb();
    const repo = new PurchaseOrderRepository(db);

    await repo.updateItem('po-1', 'item-1', { quantity: 2 });

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.__batchCalls[0]).toHaveLength(2);
    expect(db.__batchCalls[0][0].sql).toContain('UPDATE purchase_order_items SET quantity = ?');
    expect(db.__batchCalls[0][1].sql).toContain('UPDATE purchase_orders SET updated_at = ? WHERE id = ?');
  });

  it('removeItem batches the line deletion and header timestamp refresh together when scoped by po_id', async () => {
    const db = createScopedMutationDb();
    const repo = new PurchaseOrderRepository(db);

    await repo.removeItem('po-1', 'item-1');

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.__batchCalls[0]).toHaveLength(2);
    expect(db.__batchCalls[0][0].sql).toContain('DELETE FROM purchase_order_items WHERE id = ? AND po_id = ?');
    expect(db.__batchCalls[0][1].sql).toContain('UPDATE purchase_orders SET updated_at = ? WHERE id = ?');
  });

  it('findActiveBindingsByPreOrderIds returns non-cancelled purchase-order bindings', async () => {
    const all = vi.fn(async () => ({
      results: [
        {
          pre_order_id: 'o-1',
          po_id: 'po-1',
          po_no: 'PO-001',
          po_status: 'draft',
        },
      ],
    }));
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ all })),
      })),
    };
    const repo = new PurchaseOrderRepository(db);

    const bindings = await repo.findActiveBindingsByPreOrderIds(['o-1', 'o-2']);

    expect(bindings).toEqual([
      expect.objectContaining({
        pre_order_id: 'o-1',
        po_id: 'po-1',
        po_status: 'draft',
      }),
    ]);
    expect(db.prepare.mock.calls[0][0]).toContain("po.status != 'cancelled'");
  });

  it('deleteIfEmptyDraft only removes empty draft purchase orders', async () => {
    const db = createDb(1);
    const repo = new PurchaseOrderRepository(db);

    const removed = await repo.deleteIfEmptyDraft('po-1');

    expect(removed).toBe(true);
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain("status = 'draft'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('FROM purchase_order_items');
  });
});
