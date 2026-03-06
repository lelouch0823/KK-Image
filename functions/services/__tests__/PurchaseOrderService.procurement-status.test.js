import { describe, it, expect, vi } from 'vitest';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

function createDb() {
  const sqls = [];
  const db = {
    __sqls: sqls,
    prepare: vi.fn((sql) => {
      sqls.push(sql);
      const stmt = { bind: vi.fn(() => stmt) };
      return stmt;
    }),
    batch: vi.fn(async (stmts) => stmts.map(() => ({ meta: { changes: 1 } }))),
  };
  return db;
}

describe('PurchaseOrderService procurement status cascade', () => {
  it('updates linked orders procurement_status without changing orders.status', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({ id: 'po-1', status: 'draft', items: [] })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => ['o-1']),
    };

    await service.updateStatus('po-1', 'ordered');

    const joinedSql = db.__sqls.join('\n');
    expect(joinedSql).toContain('SET procurement_status = ?');
    expect(joinedSql).not.toContain('UPDATE orders SET status = ?');
  });

  it('skips delivered/void linked orders during auto cascade', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({ id: 'po-1', status: 'ordered', items: [] })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => ['o-1']),
    };

    await service.updateStatus('po-1', 'shipping');

    const joinedSql = db.__sqls.join('\n');
    expect(joinedSql).toContain(`status NOT IN ('delivered', 'void')`);
  });

  it('throws conflict when po status CAS fails (concurrent transition)', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({ id: 'po-1', status: 'draft', items: [] })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => false),
      getLinkedOrderIds: vi.fn(async () => []),
    };

    await expect(service.updateStatus('po-1', 'ordered')).rejects.toThrow(/状态已变化|refresh/i);
  });
});
