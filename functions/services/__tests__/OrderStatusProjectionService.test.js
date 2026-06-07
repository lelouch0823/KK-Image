import { describe, expect, it } from 'vitest';
import { projectOrderLineStatus } from '../OrderStatusProjectionService.js';

describe('OrderStatusProjectionService', () => {
  it('projects partially_received when received quantity lags ordered quantity', () => {
    const status = projectOrderLineStatus({
      orderedQuantity: 10,
      procuredQuantity: 10,
      receivedQuantity: 4,
      shippedQuantity: 0,
      cancelledQuantity: 0,
    });

    expect(status).toBe('partially_received');
  });

  it('projects completed when shipped quantity reaches ordered quantity', () => {
    const status = projectOrderLineStatus({
      orderedQuantity: 6,
      procuredQuantity: 6,
      receivedQuantity: 6,
      shippedQuantity: 6,
      cancelledQuantity: 0,
    });

    expect(status).toBe('completed');
  });

  it('projects cancelled when cancelled quantity reaches ordered quantity', () => {
    const status = projectOrderLineStatus({
      orderedQuantity: 5,
      procuredQuantity: 0,
      receivedQuantity: 0,
      shippedQuantity: 0,
      cancelledQuantity: 5,
    });

    expect(status).toBe('cancelled');
  });

  it('supports repository-shaped qty fields from order_lines rows', () => {
    expect(
      projectOrderLineStatus({
        ordered_qty: 5,
        cancelled_qty: 5,
      })
    ).toBe('cancelled');

    expect(
      projectOrderLineStatus({
        ordered_qty: 4,
        procured_qty: 4,
        received_qty: 4,
        shipped_qty: 0,
        cancelled_qty: 0,
      })
    ).toBe('ready');
  });

  it('uses remaining non-cancelled quantity when projecting ready and completed states', () => {
    expect(
      projectOrderLineStatus({
        ordered_qty: 10,
        procured_qty: 10,
        received_qty: 6,
        shipped_qty: 0,
        cancelled_qty: 4,
      })
    ).toBe('ready');

    expect(
      projectOrderLineStatus({
        ordered_qty: 10,
        procured_qty: 10,
        received_qty: 6,
        shipped_qty: 6,
        cancelled_qty: 4,
      })
    ).toBe('completed');
  });
});
