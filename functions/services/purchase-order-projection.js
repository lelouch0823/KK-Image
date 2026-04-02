export function toNonNegativeInt(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function getPurchaseOrderOrderedQty(record = {}) {
  if (record.quantity != null) return toNonNegativeInt(record.quantity);
  if (record.ordered_qty != null) return toNonNegativeInt(record.ordered_qty);

  if (Array.isArray(record.items)) {
    return record.items.reduce((sum, item) => sum + getPurchaseOrderOrderedQty(item), 0);
  }

  return 0;
}

export function getPurchaseOrderCancelledQty(record = {}) {
  if (record.cancelled_qty != null) return toNonNegativeInt(record.cancelled_qty);

  if (Array.isArray(record.items)) {
    return record.items.reduce((sum, item) => sum + getPurchaseOrderCancelledQty(item), 0);
  }

  return 0;
}

export function getPurchaseOrderReceivedQty(record = {}) {
  if (record.received_qty != null) return toNonNegativeInt(record.received_qty);

  if (Array.isArray(record.items)) {
    return record.items.reduce((sum, item) => sum + getPurchaseOrderReceivedQty(item), 0);
  }

  return 0;
}

export function getPurchaseOrderOutstandingQty(record = {}) {
  if (record.outstanding_qty != null) return toNonNegativeInt(record.outstanding_qty);

  if (Array.isArray(record.items)) {
    return record.items.reduce((sum, item) => sum + getPurchaseOrderOutstandingQty(item), 0);
  }

  return Math.max(
    getPurchaseOrderOrderedQty(record) -
      getPurchaseOrderReceivedQty(record) -
      getPurchaseOrderCancelledQty(record),
    0
  );
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
  const ordered = getPurchaseOrderOrderedQty(item);
  const received = getPurchaseOrderReceivedQty(item);
  const cancelled = getPurchaseOrderCancelledQty(item);

  if (ordered > 0 && cancelled >= ordered) return 'cancelled';
  if (ordered > 0 && received >= Math.max(ordered - cancelled, 0)) return 'received';
  if (received > 0) return 'partially_received';
  return 'open';
}

export function projectPurchaseOrderDisplayStatus(progress = {}) {
  const ordered = getPurchaseOrderOrderedQty(progress);
  const received = getPurchaseOrderReceivedQty(progress);
  const cancelled = getPurchaseOrderCancelledQty(progress);
  const outstanding = getPurchaseOrderOutstandingQty(progress);

  if (ordered > 0 && cancelled >= ordered) return 'cancelled';
  if (ordered > 0 && outstanding <= 0) return 'received';
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
