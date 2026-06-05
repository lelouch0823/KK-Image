import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryRepository } from '../InventoryRepository.js';

/** 创建语句 mock（返回 statement 本身，不调用 run） */
function createStatement() {
  const statement = {
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return statement;
}

describe('InventoryRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // upsertBalance
  // ==========================================
  describe('upsertBalance', () => {
    it('正数增量：绑定 MAX(delta,0) 作为 on_hand 和 available', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.upsertBalance('var-1', 10, 1710000000000);

      expect(db.prepare.mock.calls[0][0]).toContain('INSERT INTO inventory_balances');
      expect(db.prepare.mock.calls[0][0]).toContain('ON CONFLICT');
      expect(db.prepare.mock.calls[0][0]).toContain('MAX(0, inventory_balances.on_hand + ?)');
      // 参数: variantId, max(delta,0), max(delta,0), timestamp, delta, delta
      expect(stmt.params).toEqual(['var-1', 10, 10, 1710000000000, 10, 10]);
    });

    it('负数增量：on_hand 和 available 使用 MAX(0, delta) = 0', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.upsertBalance('var-1', -5, 1710000000000);

      // MAX(-5, 0) = 0
      expect(stmt.params).toEqual(['var-1', 0, 0, 1710000000000, -5, -5]);
    });

    it('增量为 0 时仍构建有效语句', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.upsertBalance('var-1', 0, 1710000000000);

      expect(stmt.params).toEqual(['var-1', 0, 0, 1710000000000, 0, 0]);
    });
  });

  // ==========================================
  // upsertReservedBalance
  // ==========================================
  describe('upsertReservedBalance', () => {
    it('正数预留：reserved 使用 MAX(delta,0)', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.upsertReservedBalance('var-1', 5, 1710000000000);

      expect(db.prepare.mock.calls[0][0]).toContain('INSERT INTO inventory_balances');
      expect(db.prepare.mock.calls[0][0]).toContain('reserved = MAX(0, inventory_balances.reserved + ?)');
      expect(stmt.params).toEqual(['var-1', 5, 1710000000000, 5, 5]);
    });

    it('负数释放：reserved 使用 MAX(delta,0) = 0', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.upsertReservedBalance('var-1', -3, 1710000000000);

      // MAX(-3, 0) = 0 用于 INSERT 值
      expect(stmt.params).toEqual(['var-1', 0, 1710000000000, -3, -3]);
    });
  });

  // ==========================================
  // addLedgerEntry
  // ==========================================
  describe('addLedgerEntry', () => {
    it('插入台账记录（含元数据对象）', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.addLedgerEntry({
        id: 'ledger-1',
        variantId: 'var-1',
        eventType: 'purchase_received',
        quantityDelta: 10,
        referenceType: 'purchase_receipt',
        referenceId: 'receipt-1',
        occurredAt: 1710000000000,
        metadata: { po_id: 'po-1' },
      });

      expect(db.prepare.mock.calls[0][0]).toContain('INSERT INTO inventory_ledger');
      expect(stmt.params[0]).toBe('ledger-1');
      expect(stmt.params[1]).toBe('var-1');
      expect(stmt.params[2]).toBe('purchase_received');
      expect(stmt.params[3]).toBe(10);
      expect(stmt.params[4]).toBe('purchase_receipt');
      expect(stmt.params[5]).toBe('receipt-1');
      expect(stmt.params[6]).toBe(1710000000000);
      expect(stmt.params[7]).toBe('{"po_id":"po-1"}');
      expect(stmt.params[8]).toBe(1710000000000); // created_at = occurredAt
    });

    it('元数据为字符串时直接使用', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.addLedgerEntry({
        id: 'ledger-1',
        variantId: 'var-1',
        eventType: 'adjustment',
        quantityDelta: -2,
        referenceType: 'manual',
        referenceId: 'adj-1',
        occurredAt: 1710000000000,
        metadata: '{"reason":"盘点调整"}',
      });

      expect(stmt.params[7]).toBe('{"reason":"盘点调整"}');
    });

    it('元数据为空时使用默认 JSON', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.addLedgerEntry({
        id: 'ledger-1',
        variantId: 'var-1',
        eventType: 'adjustment',
        quantityDelta: 1,
        referenceType: 'manual',
        referenceId: 'adj-1',
        occurredAt: 1710000000000,
      });

      expect(stmt.params[7]).toBe('{}');
    });
  });

  // ==========================================
  // addEvent
  // ==========================================
  describe('addEvent', () => {
    it('插入事件记录（含订单行和采购收据关联）', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.addEvent({
        id: 'evt-1',
        variantId: 'var-1',
        orderLineId: 'line-1',
        purchaseReceiptId: 'receipt-1',
        eventType: 'purchase_received',
        quantityDelta: 10,
        sourceType: 'purchase_order',
        sourceId: 'po-1',
        occurredAt: 1710000000000,
        metadata: { carrier: '顺丰' },
      });

      const sql = db.prepare.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO inventory_events');
      expect(sql).toContain('order_line_id');
      expect(sql).toContain('purchase_receipt_id');
      expect(stmt.params[0]).toBe('evt-1');
      expect(stmt.params[1]).toBe('var-1');
      expect(stmt.params[2]).toBe('line-1');
      expect(stmt.params[3]).toBe('receipt-1');
      expect(stmt.params[4]).toBe('purchase_received');
      expect(stmt.params[5]).toBe(10);
      expect(stmt.params[6]).toBe('purchase_order');
      expect(stmt.params[7]).toBe('po-1');
      expect(stmt.params[8]).toBe('{"carrier":"顺丰"}');
      expect(stmt.params[9]).toBe(1710000000000); // occurred_at
      expect(stmt.params[10]).toBe(1710000000000); // created_at
    });

    it('可选关联字段默认为 null', () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new InventoryRepository(db);

      repo.addEvent({
        id: 'evt-1',
        variantId: 'var-1',
        eventType: 'adjustment',
        quantityDelta: -1,
        sourceType: 'manual',
        sourceId: 'adj-1',
        occurredAt: 1710000000000,
      });

      expect(stmt.params[2]).toBeNull(); // order_line_id
      expect(stmt.params[3]).toBeNull(); // purchase_receipt_id
      expect(stmt.params[8]).toBe('{}');  // metadata 默认值
    });
  });
});
