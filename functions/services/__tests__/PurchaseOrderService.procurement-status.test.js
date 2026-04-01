import { describe, it, expect, vi } from 'vitest';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

function createDb() {
  const sqls = [];
  const batchCalls = [];
  const db = {
    __sqls: sqls,
    __batchCalls: batchCalls,
    prepare: vi.fn((sql) => {
      sqls.push(sql);
      const stmt = { bind: vi.fn(() => stmt) };
      return stmt;
    }),
    batch: vi.fn(async (stmts) => {
      batchCalls.push(stmts);
      return stmts.map(() => ({ meta: { changes: 1 } }));
    }),
  };
  return db;
}

describe('PurchaseOrderService procurement status cascade', () => {
  it('only seeds linked orders to ordered without changing orders.status', async () => {
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
    expect(joinedSql).toContain(`COALESCE(procurement_status, 'none') = 'none'`);
  });

  it('seeds shipping orders only when linked orders are still untouched', async () => {
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
    expect(joinedSql).toContain(`COALESCE(procurement_status, 'none') = 'none'`);
    expect(joinedSql).not.toContain(`COALESCE(procurement_status, 'none') != ?`);
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

  it('does not double-apply inventory when repeated arrival is attempted through stale state', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'shipping',
        ordered_qty: 5,
        received_qty: 5,
        cancelled_qty: 0,
        outstanding_qty: 0,
        items: [{ variant_id: 'v-1', quantity: 5 }],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => false),
      getLinkedOrderIds: vi.fn(async () => []),
    };
    service.inventoryService = {
      applyBatch: vi.fn(async () => ({ productCount: 1, totalQty: 5 })),
    };

    await expect(service.updateStatus('po-1', 'arrived')).rejects.toThrow(/状态已变化|refresh/i);
    expect(service.inventoryService.applyBatch).not.toHaveBeenCalled();
  });

  it('rejects shipping -> arrived when outstanding quantity remains unreceived', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'shipping',
        ordered_qty: 10,
        received_qty: 0,
        cancelled_qty: 0,
        outstanding_qty: 10,
        items: [],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => []),
    };

    await expect(service.updateStatus('po-1', 'arrived')).rejects.toThrow(/待收|未收|已入库/);
  });

  it('allows shipping -> arrived when all quantity is closed by receipts and cancellations', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'shipping',
        ordered_qty: 10,
        received_qty: 8,
        cancelled_qty: 2,
        outstanding_qty: 0,
        items: [],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => []),
    };

    await expect(service.updateStatus('po-1', 'arrived')).resolves.toMatchObject({
      success: true,
      targetProcurementStatus: null,
      cascadedOrders: 0,
      changedOrderStatuses: [],
    });
  });

  it('does not force linked orders to arrived when a purchase order header enters arrived', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'shipping',
        ordered_qty: 5,
        received_qty: 5,
        cancelled_qty: 0,
        outstanding_qty: 0,
        items: [],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => ['o-1']),
    };

    const result = await service.updateStatus('po-1', 'arrived');

    expect(result).toMatchObject({
      targetProcurementStatus: null,
      cascadedOrders: 0,
      changedOrderStatuses: [],
    });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('rejects cancelling an arrived purchase order and does not touch inventory', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({ id: 'po-1', status: 'arrived', items: [{ variant_id: 'v-1', quantity: 5 }] })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => []),
    };
    service.inventoryService = {
      applyBatch: vi.fn(async () => ({ productCount: 1, totalQty: 5 })),
    };

    await expect(service.updateStatus('po-1', 'cancelled')).rejects.toThrow(/无法从 "arrived" 转换到 "cancelled"/);
    expect(service.inventoryService.applyBatch).not.toHaveBeenCalled();
  });

  it('chunks large linked-order procurement cascades into D1-safe batches and reports changed order ids', async () => {
    const db = createDb();
    const service = new PurchaseOrderService(db);
    const linkedOrderIds = Array.from({ length: 205 }, (_, index) => `o-${index + 1}`);
    service.repo = {
      findById: vi.fn(async () => ({ id: 'po-1', status: 'draft', items: [] })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => linkedOrderIds),
    };

    const result = await service.updateStatus('po-1', 'ordered');

    expect(db.batch).toHaveBeenCalledTimes(3);
    expect(Math.max(...db.__batchCalls.map((stmts) => stmts.length))).toBeLessThanOrEqual(100);
    expect(result.cascadedOrders).toBe(205);
    expect(result.changedOrderIds).toEqual(linkedOrderIds);
    expect(result.targetProcurementStatus).toBe('ordered');
    expect(result.changedOrderStatuses).toEqual(
      linkedOrderIds.map((orderId) => ({ orderId, procurementStatus: 'ordered' }))
    );
  });
});
