import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryEventRepository } from '../InventoryEventRepository.js';

function createMockDb() {
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

describe('InventoryEventRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts inventory events with metadata JSON payloads', async () => {
    const db = createMockDb();
    const repo = new InventoryEventRepository(db);

    const created = await repo.create({
      id: 'event-1',
      variant_id: 'var-1',
      order_line_id: 'line-1',
      purchase_receipt_id: 'receipt-1',
      event_type: 'purchase_received',
      quantity_delta: 12,
      source_type: 'purchase_order',
      source_id: 'po-1',
      metadata: { carrier: 'Breeze Logistics' },
      occurred_at: 1690000000000,
    });

    expect(db.prepare).toHaveBeenCalled();
    expect(db.prepare.mock.results[0].value.run).toHaveBeenCalledTimes(1);
    const insertSql = db.prepare.mock.calls[0][0];
    expect(insertSql).toContain('INSERT INTO inventory_events');
    expect(insertSql).not.toContain('updated_at');
    const params = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(params).toHaveLength(11);
    expect(params[0]).toBe('event-1');
    expect(params[1]).toBe('var-1');
    expect(params[2]).toBe('line-1');
    expect(params[3]).toBe('receipt-1');
    expect(params[4]).toBe('purchase_received');
    expect(params[5]).toBe(12);
    expect(params[6]).toBe('purchase_order');
    expect(params[7]).toBe('po-1');
    expect(params[8]).toBe(JSON.stringify({ carrier: 'Breeze Logistics' }));
    expect(params[9]).toBe(1690000000000);
    expect(params[10]).toBeDefined();
    expect(created).toEqual({
      id: 'event-1',
      occurred_at: 1690000000000,
      created_at: params[10],
    });
  });

  it('rejects event creation when quantity_delta is missing', async () => {
    const db = createMockDb();
    const repo = new InventoryEventRepository(db);

    await expect(
      repo.create({
        event_type: 'purchase_received',
      })
    ).rejects.toThrow(/quantity_delta/i);

    expect(db.prepare).not.toHaveBeenCalled();
  });
});
