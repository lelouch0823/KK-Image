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

export function getAllowedOrderTransitions(status) {
  if (!status) return [];
  return ORDER_STATUS_TRANSITIONS[status] || [];
}

export function canTransitionOrderStatus(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return true;
  return getAllowedOrderTransitions(fromStatus).includes(toStatus);
}

export function isHighRiskOrderStatus(status) {
  return ORDER_HIGH_RISK_STATUSES.includes(status);
}

export function hasForceStatusPermission(permissions = []) {
  return Array.isArray(permissions) && (permissions.includes('admin:full') || permissions.includes('*'));
}
