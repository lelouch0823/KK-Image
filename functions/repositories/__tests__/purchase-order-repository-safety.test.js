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

describe('PurchaseOrderRepository safety guards', () => {
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

  it('removeItem must be scoped by po_id', async () => {
    const db = createDb(1);
    const repo = new PurchaseOrderRepository(db);

    await repo.removeItem('po-1', 'item-1');

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WHERE id = ? AND po_id = ?');
  });

  it('updateItem must be scoped by po_id', async () => {
    const db = createDb(1);
    const repo = new PurchaseOrderRepository(db);

    await repo.updateItem('po-1', 'item-1', { quantity: 2 });

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WHERE id = ? AND po_id = ?');
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
});
