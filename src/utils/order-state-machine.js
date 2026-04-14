const ORDER_STATUS_ALIASES = Object.freeze({
  delivered: 'fulfilled',
});

export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: ['confirmed', 'rejected', 'void'],
  confirmed: ['production', 'fulfilled', 'rejected', 'void'],
  production: ['shipping', 'fulfilled', 'rejected', 'void'],
  shipping: ['arrived', 'fulfilled', 'void'],
  arrived: ['fulfilled', 'void'],
  fulfilled: ['void'],
  rejected: ['pending', 'void'],
  void: ['pending'],
});

export const ORDER_HIGH_RISK_STATUSES = Object.freeze(['fulfilled', 'delivered', 'void']);

export function normalizeOrderStatus(status) {
  if (!status) return '';
  const normalized = String(status).trim().toLowerCase();
  return ORDER_STATUS_ALIASES[normalized] || normalized;
}

export function getAllowedOrderTransitions(status) {
  const normalizedStatus = normalizeOrderStatus(status);
  if (!normalizedStatus) return [];
  return ORDER_STATUS_TRANSITIONS[normalizedStatus] || [];
}

export function canTransitionOrderStatus(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return false;
  const normalizedFromStatus = normalizeOrderStatus(fromStatus);
  const normalizedToStatus = normalizeOrderStatus(toStatus);
  if (normalizedFromStatus === normalizedToStatus) return true;
  return getAllowedOrderTransitions(normalizedFromStatus).includes(normalizedToStatus);
}

export function isHighRiskOrderStatus(status) {
  return ORDER_HIGH_RISK_STATUSES.includes(normalizeOrderStatus(status));
}

export function hasForceStatusPermission(permissions = []) {
  return Array.isArray(permissions) && permissions.includes('admin:full');
}
