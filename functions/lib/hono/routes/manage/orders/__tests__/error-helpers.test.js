import { describe, expect, it } from 'vitest';
import { INVALID_ORDER_STATUS_TRANSITION_ERROR } from '../../../../../../api/utils/order-state-machine.js';

import { isInsufficientStockError, isInvalidStatusTransitionError } from '../error-helpers.js';

describe('orders error helpers', () => {
  it('detects insufficient stock error by message', () => {
    expect(isInsufficientStockError(new Error('insufficient variant stock for delivery'))).toBe(
      true
    );
    expect(isInsufficientStockError(new Error('other issue'))).toBe(false);
  });

  it('detects invalid status transition error by state machine marker', () => {
    expect(
      isInvalidStatusTransitionError(
        new Error(`${INVALID_ORDER_STATUS_TRANSITION_ERROR}: pending -> delivered`)
      )
    ).toBe(true);
    expect(isInvalidStatusTransitionError(new Error('another failure'))).toBe(false);
  });
});
