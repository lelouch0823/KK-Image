function toProgressNumber(value) {
  return Number(value || 0);
}

export function getPurchaseOrderOrderedQty(record = {}) {
  if (record.quantity != null) return toProgressNumber(record.quantity);
  if (record.ordered_qty != null) return toProgressNumber(record.ordered_qty);

  if (Array.isArray(record.items)) {
    return record.items.reduce((sum, item) => sum + getPurchaseOrderOrderedQty(item), 0);
  }

  return 0;
}

export function getPurchaseOrderCancelledQty(record = {}) {
  if (record.cancelled_qty != null) return Math.max(toProgressNumber(record.cancelled_qty), 0);

  if (Array.isArray(record.items)) {
    return record.items.reduce(
      (sum, item) => sum + Math.max(toProgressNumber(item?.cancelled_qty), 0),
      0
    );
  }

  return 0;
}

export function getPurchaseOrderOutstandingQty(record = {}) {
  if (record.outstanding_qty != null) {
    return Math.max(toProgressNumber(record.outstanding_qty), 0);
  }

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

export function getPurchaseOrderReceivedQty(record = {}) {
  if (record.received_qty != null) return Math.max(toProgressNumber(record.received_qty), 0);

  if (Array.isArray(record.items)) {
    return record.items.reduce(
      (sum, item) => sum + Math.max(toProgressNumber(item?.received_qty), 0),
      0
    );
  }

  return 0;
}
