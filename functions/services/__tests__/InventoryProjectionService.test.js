import { describe, expect, it } from 'vitest';
import { appendInventoryLedgerEvent, projectInventoryBalances } from '../InventoryProjectionService.js';

describe('InventoryProjectionService', () => {
  it('derives balances from event stream deltas and keeps ledger append-only', () => {
    const originalLedger = Object.freeze([
      Object.freeze({ event_type: 'purchase_received', quantity_delta: 10 }),
      Object.freeze({ event_type: 'inventory_reserved', quantity_delta: 4 }),
      Object.freeze({ event_type: 'inventory_released', quantity_delta: -1 }),
      Object.freeze({ event_type: 'order_shipment', quantity_delta: -3 }),
    ]);

    const nextLedger = appendInventoryLedgerEvent(
      originalLedger,
      Object.freeze({ event_type: 'manual_adjustment', quantity_delta: -20 })
    );
    const projection = projectInventoryBalances(nextLedger);

    expect(nextLedger).toHaveLength(originalLedger.length + 1);
    expect(nextLedger.slice(0, originalLedger.length)).toEqual(originalLedger);
    expect(projection).toEqual({
      on_hand: 0,
      reserved: 3,
      available: 0,
    });
  });

  it('supports camelCase event fields and reservedDelta fallback behavior', () => {
    const projection = projectInventoryBalances([
      { eventType: 'purchase_arrival', quantityDelta: 5 },
      { eventType: 'reservation_hold', quantityDelta: 2 },
      { eventType: 'inventory_reserved', quantityDelta: 2, reservedDelta: 1 },
      { eventType: 'reservation_release', quantityDelta: -1 },
    ]);

    expect(projection).toEqual({
      on_hand: 5,
      reserved: 2,
      available: 3,
    });
  });

  it('clamps stock and reservation floors after each event, not only at the end', () => {
    const projection = projectInventoryBalances([
      { event_type: 'order_shipment', quantity_delta: -5 },
      { event_type: 'purchase_arrival', quantity_delta: 2 },
      { event_type: 'reservation_release', quantity_delta: -4 },
      { event_type: 'reservation_hold', quantity_delta: 1 },
    ]);

    expect(projection).toEqual({
      on_hand: 2,
      reserved: 1,
      available: 1,
    });
  });

  it('applies reversal-style stock events when replaying balances', () => {
    const projection = projectInventoryBalances([
      { event_type: 'purchase_received', quantity_delta: 5 },
      { event_type: 'inventory_adjusted_reversal', quantity_delta: -2 },
      { event_type: 'order_unshipment', quantity_delta: 1 },
    ]);

    expect(projection).toEqual({
      on_hand: 4,
      reserved: 0,
      available: 4,
    });
  });
});
