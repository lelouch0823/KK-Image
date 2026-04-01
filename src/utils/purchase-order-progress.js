function toProgressNumber(value) {
  return Number(value || 0);
}

export function getPurchaseOrderOrderedQty(record = {}) {
  return toProgressNumber(record.quantity ?? record.ordered_qty);
}

export function getPurchaseOrderOutstandingQty(record = {}) {
  if (record.outstanding_qty != null) {
    return Math.max(toProgressNumber(record.outstanding_qty), 0);
  }

  return Math.max(
    getPurchaseOrderOrderedQty(record) -
      toProgressNumber(record.received_qty) -
      toProgressNumber(record.cancelled_qty),
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
