import { describe, expect, it, vi } from 'vitest';
import { DemandService } from '../DemandService.js';

describe('DemandService', () => {
  it('treats confirmed orders as active demand creation', async () => {
    const service = new DemandService({});
    const effect = await service.syncOrderTransition({ fromStatus: 'pending', toStatus: 'confirmed' });

    expect(effect).toEqual({
      createsDemand: true,
      releasesDemand: false,
      stockDeductionPending: false,
      entersReservation: true,
      releasesReservation: false,
      consumesReservation: false,
      reservationDelta: 0,
      shipmentDelta: 0,
    });
  });

  it('releases demand when confirmed orders are voided, rejected, or cancelled', async () => {
    const service = new DemandService({});

    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'void' }))
      .resolves.toMatchObject({ releasesDemand: true, releasesReservation: true });
    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'rejected' }))
      .resolves.toMatchObject({ releasesDemand: true, releasesReservation: true });
    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'cancelled' }))
      .resolves.toMatchObject({ releasesDemand: true, releasesReservation: true });
  });

  it('flags shipping and delivered transitions for later stock deduction integration', async () => {
    const service = new DemandService({});

    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'shipping' }))
      .resolves.toMatchObject({ stockDeductionPending: true });
    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'delivered' }))
      .resolves.toMatchObject({ stockDeductionPending: true, consumesReservation: true });
  });

  it('aggregates confirmed demand by variant', async () => {
    const stmt = {
      all: vi.fn(async () => ({
        results: [
          { variant_id: 'variant-1', total_demand: 5, order_count: 2, order_ids: 'o-1,o-2' },
        ],
      })),
    };
    const service = new DemandService({
      prepare: vi.fn(() => stmt),
    });

    const rows = await service.getDemandSummaryByVariant();

    expect(rows).toEqual([
      {
        variant_id: 'variant-1',
        total_demand: 5,
        order_count: 2,
        order_ids: ['o-1', 'o-2'],
      },
    ]);
  });

  it('aggregates active reservation demand beyond confirmed only', async () => {
    const stmt = {
      all: vi.fn(async () => ({
        results: [
          { variant_id: 'variant-1', total_demand: 9, order_count: 3, order_ids: 'o-1,o-2,o-3' },
        ],
      })),
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new DemandService(db);

    const rows = await service.getDemandSummaryByVariant();
    const sql = db.prepare.mock.calls[0][0];

    expect(sql).toContain("o.status IN ('confirmed', 'production', 'shipping', 'arrived')");
    expect(rows[0]).toMatchObject({
      variant_id: 'variant-1',
      total_demand: 9,
      order_count: 3,
    });
  });

  it('bases demand summary on order_lines remaining quantity rather than raw order headers', async () => {
    const stmt = {
      all: vi.fn(async () => ({
        results: [
          { variant_id: 'variant-1', total_demand: 5, order_count: 1, order_ids: 'o-1' },
        ],
      })),
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new DemandService(db);

    await service.getDemandSummaryByVariant();

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('FROM order_lines ol');
    expect(sql).toContain('JOIN orders o ON o.id = ol.order_id');
    expect(sql).toContain('MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0)');
  });

  it('persists reservation projection and ledger rows when syncing transitions', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const service = new DemandService({ prepare });

    await service.syncOrderTransition({
      orderId: 'o-1',
      variantId: 'variant-1',
      quantity: 4,
      fromStatus: 'confirmed',
      toStatus: 'delivered',
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_balances'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_ledger'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_events'));
  });

  it('resolves order_line_id for reservation events when order context is supplied', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    let inventoryEventBindArgs = null;
    const db = {
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
    const service = new DemandService(db);

    await service.syncOrderTransition({
      orderId: 'o-1',
      variantId: 'variant-1',
      quantity: 4,
      fromStatus: 'confirmed',
      toStatus: 'delivered',
    });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM order_lines WHERE order_id = ?'));
    expect(inventoryEventBindArgs[2]).toBe('line-1');
    expect(inventoryEventBindArgs[5]).toBe('order');
    expect(inventoryEventBindArgs[6]).toBe('o-1');
  });

  it('rejects ambiguous multi-line demand events without an explicit orderLineId', async () => {
    const db = {
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
    const service = new DemandService(db);

    await expect(service.syncOrderTransition({
      orderId: 'o-1',
      variantId: 'variant-1',
      quantity: 4,
      fromStatus: 'confirmed',
      toStatus: 'delivered',
    })).rejects.toThrow();
  });
});
