export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: ['confirmed', 'rejected', 'void'],
  confirmed: ['production', 'rejected', 'void'],
  production: ['shipping', 'rejected', 'void'],
  shipping: ['arrived', 'void'],
  arrived: ['delivered', 'void'],
  delivered: ['void'],
  rejected: ['pending', 'void'],
  void: ['pending'],
});

export const ORDER_HIGH_RISK_STATUSES = Object.freeze(['delivered', 'void']);
export const INVALID_ORDER_STATUS_TRANSITION_ERROR = 'invalid order status transition';

export function getAllowedOrderTransitions(fromStatus) {
  if (!fromStatus) return [];
  return ORDER_STATUS_TRANSITIONS[fromStatus] || [];
}

export function canTransitionOrderStatus(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return true;
  return getAllowedOrderTransitions(fromStatus).includes(toStatus);
}

export function assertOrderStatusTransition(fromStatus, toStatus, options = {}) {
  const { forceStatusTransition = false } = options;
  if (forceStatusTransition) return true;
  if (!canTransitionOrderStatus(fromStatus, toStatus)) {
    throw new Error(INVALID_ORDER_STATUS_TRANSITION_ERROR);
  }
  return true;
}

export function isHighRiskOrderStatus(status) {
  return ORDER_HIGH_RISK_STATUSES.includes(status);
}
