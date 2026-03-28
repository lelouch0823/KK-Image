function toNonNegativeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

export function projectOrderLineStatus(line = {}) {
  const ordered = toNonNegativeNumber(line.orderedQuantity ?? line.ordered_quantity ?? line.quantity);
  const procured = toNonNegativeNumber(line.procuredQuantity ?? line.procured_quantity);
  const received = toNonNegativeNumber(line.receivedQuantity ?? line.received_quantity);
  const shipped = toNonNegativeNumber(line.shippedQuantity ?? line.shipped_quantity);
  const cancelled = toNonNegativeNumber(line.cancelledQuantity ?? line.cancelled_quantity);

  if (ordered > 0 && cancelled >= ordered) return 'cancelled';
  if (ordered > 0 && shipped >= ordered) return 'completed';
  if (shipped > 0) return 'partially_shipped';
  if (ordered > 0 && received >= ordered) return 'ready';
  if (received > 0) return 'partially_received';
  if (ordered > 0 && procured >= ordered) return 'fully_procured';
  if (procured > 0) return 'partially_procured';
  return 'unprocured';
}
