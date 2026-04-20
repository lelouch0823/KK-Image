import { describe, expect, it } from 'vitest';

import { buildBackfillLedgerRows } from '../backfill_ledger.js';
import { reconcileInventoryBalances } from '../reconcile_balances.js';

describe('inventory scripts', () => {
  it('builds backfill ledger rows from stocked variants and active orders only', () => {
    const rows = buildBackfillLedgerRows(
      [
        { id: 'variant-1', stock_quantity: 5 },
        { id: 'variant-2', stock_quantity: 0 },
        { id: '', stock_quantity: 10 },
      ],
      [
        { id: 'order-1', variant_id: 'variant-1', quantity: 2, status: 'confirmed' },
        { id: 'order-2', variant_id: 'variant-2', quantity: 0, status: 'pending' },
        { id: 'order-3', variant_id: '', quantity: 4, status: 'pending' },
      ],
      1710000000000
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        variant_id: 'variant-1',
        event_type: 'inventory_correction',
        quantity_delta: 5,
        reference_type: 'cutover_backfill',
        reference_id: 'variant-1',
        occurred_at: 1710000000000,
        created_at: 1710000000000,
      })
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        variant_id: 'variant-1',
        event_type: 'reservation_hold',
        quantity_delta: 2,
        reference_type: 'order',
        reference_id: 'order-1',
        occurred_at: 1710000000000,
        created_at: 1710000000000,
      })
    );
    expect(rows[0].metadata).toContain('product_variants.stock_quantity');
    expect(rows[1].metadata).toContain('active_orders_backfill');
  });

  it('reconciles persisted balances against projected ledger balances', () => {
    const mismatches = reconcileInventoryBalances(
      [
        { variant_id: 'variant-1', event_type: 'inventory_correction', quantity_delta: 5 },
        { variant_id: 'variant-1', event_type: 'reservation_hold', quantity_delta: 2 },
        { variant_id: 'variant-1', event_type: 'reservation_release', quantity_delta: 1 },
        { variant_id: '', event_type: 'inventory_correction', quantity_delta: 9 },
        { variant_id: 'variant-2', event_type: 'inventory_correction', quantity_delta: 3 },
      ],
      [
        { variant_id: 'variant-1', on_hand: 5, reserved: 3, available: 2 },
        { variant_id: 'variant-2', on_hand: 1, reserved: 0, available: 1 },
      ]
    );

    expect(mismatches).toEqual([
      {
        variant_id: 'variant-1',
        matches: true,
        expected: { on_hand: 5, reserved: 3, available: 2 },
        actual: { on_hand: 5, reserved: 3, available: 2 },
      },
      {
        variant_id: 'variant-2',
        matches: false,
        expected: { on_hand: 3, reserved: 0, available: 3 },
        actual: { on_hand: 1, reserved: 0, available: 1 },
      },
    ]);
  });
});
