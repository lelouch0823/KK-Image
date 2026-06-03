import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { InventoryService } from '../InventoryService.js';

describe('InventoryService', () => {
  let variantRepo;
  let service;

  beforeEach(() => {
    variantRepo = {
      adjustStock: vi.fn(async () => true),
    };
    service = new InventoryService({}, variantRepo);
  });

  it('increments stock for purchase arrivals', async () => {
    await service.applyMutation({
      type: 'purchase_arrival',
      variantId: 'variant-1',
      quantityDelta: 5,
    });

    expect(variantRepo.adjustStock).toHaveBeenCalledWith('variant-1', 5);
  });

  it('decrements stock for shipment-style mutations', async () => {
    await service.applyMutation({
      type: 'order_shipment',
      variantId: 'variant-1',
      quantityDelta: -3,
    });

    expect(variantRepo.adjustStock).toHaveBeenCalledWith('variant-1', -3);
  });

  it('rejects invalid mutation payloads', async () => {
    await expect(service.applyMutation({
      type: 'not_real',
      variantId: '',
      quantityDelta: 0,
    })).rejects.toBeInstanceOf(BadRequestError);

    expect(variantRepo.adjustStock).not.toHaveBeenCalled();
  });

  it('rejects reservation mutations that belong to demand-side reservation flows', async () => {
    await expect(service.applyMutation({
      type: 'inventory_reserved',
      variantId: 'variant-1',
      quantityDelta: 3,
    })).rejects.toBeInstanceOf(BadRequestError);

    expect(variantRepo.adjustStock).not.toHaveBeenCalled();
  });

  it('preserves the non-negative stock floor through repository-level atomic updates', async () => {
    await service.applyMutation({
      type: 'manual_adjustment',
      variantId: 'variant-1',
      quantityDelta: -999,
    });

    expect(variantRepo.adjustStock).toHaveBeenCalledWith('variant-1', -999);
  });

  it('applies batched mutations and returns aggregate counts', async () => {
    const result = await service.applyBatch([
      { type: 'purchase_arrival', variantId: 'variant-1', quantityDelta: 5 },
      { type: 'manual_adjustment', variantId: 'variant-2', quantityDelta: -2 },
    ]);

    expect(result).toEqual({
      productCount: 2,
      totalQty: 7,
    });
    expect(variantRepo.adjustStock).toHaveBeenNthCalledWith(1, 'variant-1', 5);
    expect(variantRepo.adjustStock).toHaveBeenNthCalledWith(2, 'variant-2', -2);
  });

  it('updates projection balances when a DB handle is available', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare, batch: vi.fn(async (statements) => statements.map(() => ({ success: true, meta: { changes: 1 } }))) };
    service = new InventoryService(db, variantRepo);

    await service.applyMutation({
      type: 'order_shipment',
      variantId: 'variant-1',
      quantityDelta: -3,
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE product_variants'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_balances'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_ledger'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_events'));
  });

  it('batches DB-backed mutations instead of running each statement serially in applyBatch', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const db = {
      batch: vi.fn(async (statements) => statements.map(() => ({ success: true, meta: { changes: 1 } }))),
      prepare: vi.fn((sql) => {
        const statement = {
          sql,
          bind: vi.fn((...params) => ({
            sql,
            params,
            run,
          })),
        };
        return statement;
      }),
    };
    service = new InventoryService(db, variantRepo);

    const result = await service.applyBatch([
      { type: 'purchase_arrival', variantId: 'variant-1', quantityDelta: 5 },
      { type: 'manual_adjustment', variantId: 'variant-2', quantityDelta: -2 },
    ]);

    expect(result).toEqual({
      productCount: 2,
      totalQty: 7,
    });
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0]).toHaveLength(8);
    expect(run).not.toHaveBeenCalled();
  });

  it('resolves order_line_id and preserves source refs in inventory_events when order context is supplied', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    let inventoryEventBindArgs = null;
    const db = {
      batch: vi.fn(async (statements) => {
        for (const stmt of statements) {
          if (stmt.run) await stmt.run();
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      }),
      prepare: vi.fn((sql) => {
        if (sql.includes('SELECT id FROM order_lines WHERE order_id = ?')) {
          const statement = {
            bind: vi.fn(() => statement),
            all: vi.fn(async () => ({ results: [{ id: 'line-1' }] })),
            first: vi.fn(async () => ({ id: 'line-1' })),
          };
          return statement;
        }

        const statement = {
          bind: vi.fn((...params) => {
            if (sql.includes('INSERT INTO inventory_events')) {
              inventoryEventBindArgs = params;
            }
            return { run };
          }),
        };
        return statement;
      }),
    };
    service = new InventoryService(db, variantRepo);

    await service.applyMutation({
      type: 'order_shipment',
      variantId: 'variant-1',
      quantityDelta: -3,
      orderId: 'o-1',
      referenceType: 'order',
      referenceId: 'o-1',
    });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM order_lines WHERE order_id = ?'));
    expect(inventoryEventBindArgs[2]).toBe('line-1');
    expect(inventoryEventBindArgs[6]).toBe('order');
    expect(inventoryEventBindArgs[7]).toBe('o-1');
  });

  it('rejects ambiguous multi-line order context without an explicit orderLineId', async () => {
    const db = {
      batch: vi.fn(async (statements) => statements.map(() => ({ success: true, meta: { changes: 1 } }))),
      prepare: vi.fn((sql) => {
        if (sql.includes('SELECT id FROM order_lines WHERE order_id = ?')) {
          const statement = {
            bind: vi.fn(() => statement),
            all: vi.fn(async () => ({ results: [{ id: 'line-1' }, { id: 'line-2' }] })),
            first: vi.fn(async () => ({ id: 'line-1' })),
          };
          return statement;
        }

        const statement = {
          bind: vi.fn(() => ({ run: vi.fn(async () => ({ meta: { changes: 1 } })) })),
        };
        return statement;
      }),
    };
    service = new InventoryService(db, variantRepo);

    await expect(service.applyMutation({
      type: 'order_shipment',
      variantId: 'variant-1',
      quantityDelta: -3,
      orderId: 'o-1',
      referenceType: 'order',
      referenceId: 'o-1',
    })).rejects.toBeInstanceOf(BadRequestError);
  });
});
