export function toNonNegativeInt(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function computePurchaseOrderRemainingReceivable(item = {}) {
  return Math.max(
    toNonNegativeInt(item.quantity) -
      toNonNegativeInt(item.received_qty) -
      toNonNegativeInt(item.cancelled_qty),
    0
  );
}

export function projectPurchaseOrderItemStatus(item = {}) {
  const ordered = toNonNegativeInt(item.quantity);
  const received = toNonNegativeInt(item.received_qty);
  const cancelled = toNonNegativeInt(item.cancelled_qty);

  if (ordered > 0 && cancelled >= ordered) return 'cancelled';
  if (ordered > 0 && received >= Math.max(ordered - cancelled, 0)) return 'received';
  if (received > 0) return 'partially_received';
  return 'open';
}

export function projectCompatibilityProcurementStatus(progress = {}) {
  const ordered = toNonNegativeInt(progress.ordered_qty);
  const procured = toNonNegativeInt(progress.procured_qty);
  const received = toNonNegativeInt(progress.received_qty);
  const cancelled = toNonNegativeInt(progress.cancelled_qty);
  const receivable = Math.max(ordered - cancelled, 0);

  if (receivable <= 0) return 'none';
  if (received >= receivable) return 'arrived';
  if (received > 0) return 'partially_arrived';
  if (procured > 0) return 'ordered';
  return 'none';
}
