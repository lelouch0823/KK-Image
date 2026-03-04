import { describe, expect, it } from 'vitest';
import {
  ORDER_HIGH_RISK_STATUSES,
  INVALID_ORDER_STATUS_TRANSITION_ERROR,
  canTransitionOrderStatus,
  getAllowedOrderTransitions,
  assertOrderStatusTransition,
} from '../order-state-machine.js';

describe('order-state-machine', () => {
  it('returns allowed transitions for a normal status', () => {
    expect(getAllowedOrderTransitions('pending')).toEqual(['confirmed', 'rejected', 'void']);
  });

  it('validates in-flow and out-of-flow transitions', () => {
    expect(canTransitionOrderStatus('pending', 'confirmed')).toBe(true);
    expect(canTransitionOrderStatus('pending', 'delivered')).toBe(false);
  });

  it('throws for out-of-flow transition without force', () => {
    expect(() => assertOrderStatusTransition('pending', 'delivered')).toThrow(
      INVALID_ORDER_STATUS_TRANSITION_ERROR
    );
  });

  it('allows out-of-flow transition with force option', () => {
    expect(() =>
      assertOrderStatusTransition('pending', 'delivered', { forceStatusTransition: true })
    ).not.toThrow();
  });

  it('marks delivered and void as high-risk statuses', () => {
    expect(ORDER_HIGH_RISK_STATUSES).toContain('delivered');
    expect(ORDER_HIGH_RISK_STATUSES).toContain('void');
  });

  it('allows rollback from delivered to void in normal flow', () => {
    expect(canTransitionOrderStatus('delivered', 'void')).toBe(true);
  });
});
