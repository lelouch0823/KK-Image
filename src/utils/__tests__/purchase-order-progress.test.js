import { describe, expect, it } from 'vitest';

import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '../purchase-order-progress.js';

describe('purchase-order-progress', () => {
  it('prefers aggregated outstanding_qty when present', () => {
    expect(getPurchaseOrderOutstandingQty({
      outstanding_qty: 3,
      ordered_qty: 10,
      received_qty: 9,
      cancelled_qty: 0,
    })).toBe(3);
  });

  it('falls back to ordered minus received minus cancelled', () => {
    expect(getPurchaseOrderOutstandingQty({
      ordered_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
    })).toBe(5);
  });

  it('sums received quantity from items when header data is absent', () => {
    expect(getPurchaseOrderReceivedQty({
      items: [{ received_qty: 2 }, { received_qty: 3 }],
    })).toBe(5);
  });

  it('sums cancelled quantity from items when header data is absent', () => {
    expect(getPurchaseOrderCancelledQty({
      items: [{ cancelled_qty: 2 }, { cancelled_qty: 1 }],
    })).toBe(3);
  });

  it('derives ordered and outstanding quantity from items when header aggregates are absent', () => {
    const record = {
      items: [
        { quantity: 10, received_qty: 4, cancelled_qty: 1 },
        { quantity: 2, received_qty: 2, cancelled_qty: 0 },
      ],
    };

    expect(getPurchaseOrderOrderedQty(record)).toBe(12);
    expect(getPurchaseOrderOutstandingQty(record)).toBe(5);
  });

  it('uses quantity for item rows and ordered_qty for header rows', () => {
    expect(getPurchaseOrderOrderedQty({ quantity: 7 })).toBe(7);
    expect(getPurchaseOrderOrderedQty({ ordered_qty: 9 })).toBe(9);
  });
});
