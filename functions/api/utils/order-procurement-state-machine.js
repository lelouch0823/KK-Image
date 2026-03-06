export const PO_TO_PROCUREMENT_STATUS_MAP = Object.freeze({
  ordered: 'ordered',
  shipping: 'ordered',
  arrived: 'arrived',
});

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'void']);

export function isTerminalOrderStatus(status) {
  return TERMINAL_ORDER_STATUSES.has(String(status || '').toLowerCase());
}

export function canApplyProcurementStatus(orderStatus, nextProcurementStatus) {
  if (!nextProcurementStatus) return false;
  return !isTerminalOrderStatus(orderStatus);
}
