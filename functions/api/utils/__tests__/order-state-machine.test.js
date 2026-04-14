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
    expect(canTransitionOrderStatus('pending', 'fulfilled')).toBe(false);
    expect(canTransitionOrderStatus('confirmed', 'fulfilled')).toBe(true);
    expect(canTransitionOrderStatus('shipping', 'fulfilled')).toBe(true);
  });

  it('throws for out-of-flow transition without force', () => {
    expect(() => assertOrderStatusTransition('pending', 'fulfilled')).toThrow(
      INVALID_ORDER_STATUS_TRANSITION_ERROR
    );
  });

  it('allows out-of-flow transition with force option', () => {
    expect(() =>
      assertOrderStatusTransition('pending', 'fulfilled', { forceStatusTransition: true })
    ).not.toThrow();
  });

  it('marks fulfilled and void as high-risk statuses', () => {
    expect(ORDER_HIGH_RISK_STATUSES).toContain('fulfilled');
    expect(ORDER_HIGH_RISK_STATUSES).toContain('void');
  });

  it('allows rollback from fulfilled to void in normal flow', () => {
    expect(canTransitionOrderStatus('fulfilled', 'void')).toBe(true);
  });

  it('keeps legacy delivered input compatible with fulfilled flow', () => {
    expect(canTransitionOrderStatus('confirmed', 'delivered')).toBe(true);
    expect(canTransitionOrderStatus('delivered', 'void')).toBe(true);
  });
});
