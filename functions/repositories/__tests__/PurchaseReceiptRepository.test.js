import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseReceiptRepository } from '../PurchaseReceiptRepository.js';

function createDbMock() {
  return {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        bind: vi.fn(function bindStatement() {
          statement.params = Array.from(arguments);
          return statement;
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return statement;
    }),
  };
}

describe('PurchaseReceiptRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists receipt rows independently from purchase item totals', async () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = createDbMock();
    const repo = new PurchaseReceiptRepository(db);

    await repo.create({
      id: 'receipt-1',
      purchase_order_id: 'po-1',
      purchase_order_item_id: 'poi-1',
      product_id: 'prod-1',
      variant_id: 'var-1',
      receipt_no: 'RC-001',
      received_qty: 7,
      note: 'Split reception',
      received_at: 1680000000000,
    });

    expect(db.prepare).toHaveBeenCalled();
    expect(db.prepare.mock.results[0].value.run).toHaveBeenCalledTimes(1);
    const insertSql = db.prepare.mock.calls[0][0];
    expect(insertSql).toContain('INSERT INTO purchase_receipts');
    const params = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(params[0]).toBe('receipt-1');
    expect(params[1]).toBe('po-1');
    expect(params[2]).toBe('poi-1');
    expect(params[3]).toBe('prod-1');
    expect(params[4]).toBe('var-1');
    expect(params[5]).toBe('RC-001');
    expect(params[6]).toBe(7);
    expect(params[7]).toBe('Split reception');
    expect(params[8]).toBe(1680000000000);
    expect(params[9]).toBe(now);
    expect(params[10]).toBe(now);
  });

  it('rejects receipt creation when received_qty is missing', async () => {
    const db = createDbMock();
    const repo = new PurchaseReceiptRepository(db);

    await expect(repo.create({
      purchase_order_id: 'po-1',
    })).rejects.toThrow(/received_qty/i);

    expect(db.prepare).not.toHaveBeenCalled();
  });
});
