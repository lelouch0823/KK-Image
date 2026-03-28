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
});
