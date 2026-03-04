import { INVALID_ORDER_STATUS_TRANSITION_ERROR } from '../../../../../api/utils/order-state-machine.js';

export const isInsufficientStockError = (error) =>
  String(error?.message || '').includes('insufficient variant stock');

export const isInvalidStatusTransitionError = (error) =>
  String(error?.message || '').includes(INVALID_ORDER_STATUS_TRANSITION_ERROR);
