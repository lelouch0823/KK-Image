import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseReceiptRepository } from '../PurchaseReceiptRepository.js';

function createDbMock() {
  const reversalRows = [];

  return {
    reversalRows,
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        bind: vi.fn(function bindStatement() {
          statement.params = Array.from(arguments);
          return statement;
        }),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO purchase_receipt_reversals')) {
            const [
              id,
              originalReceiptId,
              purchaseOrderId,
              purchaseOrderItemId,
              reversalQty,
              reason,
              commandId,
              correlationId,
              createdAt,
            ] = statement.params;

            if (reversalRows.some((row) => row.command_id === commandId)) {
              throw new Error('UNIQUE constraint failed: purchase_receipt_reversals.command_id');
            }

            reversalRows.push({
              id,
              original_receipt_id: originalReceiptId,
              purchase_order_id: purchaseOrderId,
              purchase_order_item_id: purchaseOrderItemId,
              reversal_qty: reversalQty,
              reason,
              command_id: commandId,
              correlation_id: correlationId,
              created_at: createdAt,
            });
          }

          return { success: true };
        }),
        first: vi.fn(async () => ({
          receipt_id: 'receipt-1',
          purchase_order_id: 'po-1',
          purchase_order_item_id: 'poi-1',
          variant_id: 'var-1',
          product_id: 'prod-1',
          received_qty: 5,
          pre_order_id: 'o-1',
          order_line_id: 'line-1',
          inventory_event_id: 'ie-1',
        })),
      };
      return statement;
    }),
  };
}

describe('PurchaseReceiptRepository reversals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('queries receipt lineage from persisted or inventory-derived order line ids', async () => {
    const db = createDbMock();
    const repo = new PurchaseReceiptRepository(db);

    await repo.findReceiptWithLineage('receipt-1');

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('pr.order_line_id');
    expect(sql).toContain('COALESCE(pr.order_line_id, ie.order_line_id) AS order_line_id');
    expect(sql).not.toContain('LEFT JOIN order_lines ol ON ol.order_id = poi.pre_order_id');
  });

  it('stores a reversal fact linked to the original receipt and command lineage', async () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = createDbMock();
    const repo = new PurchaseReceiptRepository(db);

    await repo.createReversal({
      id: 'reversal-1',
      original_receipt_id: 'receipt-1',
      purchase_order_id: 'po-1',
      purchase_order_item_id: 'poi-1',
      reversal_qty: 5,
      reason: 'operator rollback',
      command_id: 'cmd-reversal-1',
      correlation_id: 'cmd-reversal-1',
    });

    const statement = db.prepare.mock.results.find((result) => result.value.sql.includes('INSERT INTO purchase_receipt_reversals')).value;
    const params = statement.bind.mock.calls[0];
    expect(params).toEqual([
      'reversal-1',
      'receipt-1',
      'po-1',
      'poi-1',
      5,
      'operator rollback',
      'cmd-reversal-1',
      'cmd-reversal-1',
      now,
    ]);
  });

  it('rejects duplicate reversal records for the same reversal command idempotency key', async () => {
    const db = createDbMock();
    const repo = new PurchaseReceiptRepository(db);

    await repo.createReversal({
      id: 'reversal-1',
      original_receipt_id: 'receipt-1',
      purchase_order_id: 'po-1',
      purchase_order_item_id: 'poi-1',
      reversal_qty: 5,
      reason: 'operator rollback',
      command_id: 'cmd-reversal-1',
      correlation_id: 'cmd-reversal-1',
    });

    await expect(repo.createReversal({
      id: 'reversal-2',
      original_receipt_id: 'receipt-1',
      purchase_order_id: 'po-1',
      purchase_order_item_id: 'poi-1',
      reversal_qty: 5,
      reason: 'operator rollback',
      command_id: 'cmd-reversal-1',
      correlation_id: 'cmd-reversal-1',
    })).rejects.toThrow(/unique constraint/i);
  });
});
