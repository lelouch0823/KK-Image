import { describe, expect, it } from 'vitest';

import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
  projectPurchaseOrderDisplayStatus,
} from '../purchase-order-projection.js';

describe('purchase-order-projection', () => {
  it('derives purchase-order header quantities from items when aggregates are absent', () => {
    const header = {
      items: [
        { quantity: 10, received_qty: 4, cancelled_qty: 1 },
        { quantity: 2, received_qty: 2, cancelled_qty: 0 },
      ],
    };

    expect(getPurchaseOrderOrderedQty(header)).toBe(12);
    expect(getPurchaseOrderReceivedQty(header)).toBe(6);
    expect(getPurchaseOrderCancelledQty(header)).toBe(1);
    expect(getPurchaseOrderOutstandingQty(header)).toBe(5);
    expect(projectPurchaseOrderDisplayStatus(header)).toBe('partially_received');
  });

  it('prefers explicit header aggregates when they are already materialized', () => {
    const header = {
      ordered_qty: 10,
      received_qty: 8,
      cancelled_qty: 2,
      outstanding_qty: 0,
      items: [
        { quantity: 10, received_qty: 1, cancelled_qty: 0 },
      ],
    };

    expect(getPurchaseOrderOrderedQty(header)).toBe(10);
    expect(getPurchaseOrderReceivedQty(header)).toBe(8);
    expect(getPurchaseOrderCancelledQty(header)).toBe(2);
    expect(getPurchaseOrderOutstandingQty(header)).toBe(0);
    expect(projectPurchaseOrderDisplayStatus(header)).toBe('received');
  });
});
