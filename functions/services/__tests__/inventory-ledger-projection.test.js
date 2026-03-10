import { describe, expect, it } from 'vitest';
import { appendInventoryLedgerEvent, projectInventoryBalances } from '../InventoryService.js';

describe('inventory ledger projection invariants', () => {
  it('keeps ledger events append-only while projecting on_hand reserved and available', () => {
    const originalLedger = Object.freeze([
      Object.freeze({ event_type: 'purchase_arrival', quantity_delta: 10 }),
      Object.freeze({ event_type: 'reservation_hold', quantity_delta: 4 }),
      Object.freeze({ event_type: 'reservation_release', quantity_delta: -1 }),
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
});
