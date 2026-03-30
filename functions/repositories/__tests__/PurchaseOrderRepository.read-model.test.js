import { describe, expect, it, vi } from 'vitest';
import { PurchaseOrderRepository } from '../PurchaseOrderRepository.js';

describe('PurchaseOrderRepository read model', () => {
  it('findById scopes item query to the purchase order and exposes receipt progress', async () => {
    const poStmt = {
      bind: vi.fn(() => poStmt),
      first: vi.fn(async () => ({
        id: 'po-1',
        po_no: 'PO-1',
        status: 'shipping',
      })),
    };
    const itemsStmt = {
      bind: vi.fn(() => itemsStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'poi-1',
          po_id: 'po-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          quantity: 10,
          received_qty: 4,
          cancelled_qty: 1,
          display_status: 'partially_received',
          receipt_count: 2,
          last_received_at: 123456,
          product_images: '[]',
          product_specifications: '{}',
          variant_options: '{}',
        }],
      })),
    };
    const receiptsStmt = {
      bind: vi.fn(() => receiptsStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'receipt-1',
          purchase_order_item_id: 'poi-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          received_qty: 4,
          note: 'split receipt',
          received_at: 123460,
          created_at: 123461,
          product_name: 'Premium Canvas Bag',
          product_brand: 'KK',
          product_sku: 'BAG-001',
          variant_sku: 'BAG-001-BLK',
          variant_options: '{"Color":"Black"}',
          reversed_qty: 0,
          reversal_count: 0,
        }],
      })),
    };
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(poStmt)
        .mockReturnValueOnce(itemsStmt)
        .mockReturnValueOnce(receiptsStmt),
    };

    const repo = new PurchaseOrderRepository(db);
    const po = await repo.findById('po-1');

    expect(db.prepare.mock.calls[1][0]).toContain('FROM purchase_order_items poi');
    expect(db.prepare.mock.calls[1][0]).toContain('WHERE poi.po_id = ?');
    expect(db.prepare.mock.calls[1][0]).toContain('FROM purchase_receipts');
    expect(db.prepare.mock.calls[2][0]).toContain('FROM purchase_receipts pr');
    expect(db.prepare.mock.calls[2][0]).toContain('purchase_receipt_reversals');
    expect(po.items).toEqual([
      expect.objectContaining({
        id: 'poi-1',
        receipt_count: 2,
        last_received_at: 123456,
        display_status: 'partially_received',
      }),
    ]);
    expect(po.receipts).toEqual([
      expect.objectContaining({
        id: 'receipt-1',
        product_name: 'Premium Canvas Bag',
        variant_sku: 'BAG-001-BLK',
        received_qty: 4,
        available_reversal_qty: 4,
        is_reversed: false,
      }),
    ]);
    expect(po.item_count).toBe(1);
    expect(po.ordered_qty).toBe(10);
    expect(po.received_qty).toBe(4);
    expect(po.cancelled_qty).toBe(1);
    expect(po.outstanding_qty).toBe(5);
    expect(po.display_status).toBe('partially_received');
  });

  it('list aggregates item counts and remaining inbound quantities from purchase_order_items progress', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 1 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'po-1',
          po_no: 'PO-1',
          status: 'shipping',
          item_count: 2,
          ordered_qty: 10,
          received_qty: 4,
          cancelled_qty: 1,
          outstanding_qty: 5,
          total_goods_cost: 120,
          display_status: 'partially_received',
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const repo = new PurchaseOrderRepository(db);
    const result = await repo.list({ page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('COUNT(*) AS item_count');
    expect(db.prepare.mock.calls[1][0]).toContain('SUM(received_qty)');
    expect(db.prepare.mock.calls[1][0]).toContain('COALESCE(SUM(MAX(quantity - received_qty - cancelled_qty, 0)), 0) AS outstanding_qty');
    expect(result.items[0]).toEqual(expect.objectContaining({
      item_count: 2,
      ordered_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
      outstanding_qty: 5,
      display_status: 'partially_received',
    }));
  });

  it('getStats exposes global procurement progress quantities', async () => {
    const stmt = {
      first: vi.fn(async () => ({
        total: 3,
        draft_count: 1,
        ordered_count: 1,
        shipping_count: 1,
        arrived_count: 0,
        completed_count: 0,
        ordered_qty: 12,
        received_qty: 4,
        cancelled_qty: 1,
        outstanding_qty: 7,
      })),
    };
    const db = {
      prepare: vi.fn(() => stmt),
    };

    const repo = new PurchaseOrderRepository(db);
    const stats = await repo.getStats();

    expect(db.prepare.mock.calls[0][0]).toContain('SUM(quantity)');
    expect(db.prepare.mock.calls[0][0]).toContain('SUM(received_qty)');
    expect(db.prepare.mock.calls[0][0]).toContain('SUM(MAX(quantity - received_qty - cancelled_qty, 0))');
    expect(stats).toEqual(expect.objectContaining({
      ordered_qty: 12,
      received_qty: 4,
      cancelled_qty: 1,
      outstanding_qty: 7,
    }));
  });
});
