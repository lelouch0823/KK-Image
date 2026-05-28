export const resolveOrderProgressStatus = (order = {}) =>
  order.displayStatus || order.procurementStatus || 'none';

export const resolveOrderDeliveryStatus = (order = {}) =>
  order.deliveryStatus || 'not_shipped';

export const resolveOrderQuantity = (order = {}) => {
  const quantity = Number(order.quantity ?? order.currentData?.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

export const resolveOrderProductName = (order = {}) =>
  order.currentData?.name || order.lines?.[0]?.snapshotName || order.productName || '';

export const isMultilineOrder = (order = {}) =>
  Array.isArray(order.lines) && order.lines.length > 1;

export const resolveHistoricalOrderProductName = (order = {}) =>
  order.lines?.[0]?.snapshotName || order.productName || order.currentData?.name || order.originalData?.name || '';

export const resolveOrderSnapshotField = (order = {}, field = '') => {
  if (!field) return '';
  if (field === 'name') return resolveHistoricalOrderProductName(order);
  return order.currentData?.[field] || order.originalData?.[field] || '';
};

export const buildOrderDetailDisplayData = (order = {}, { multilineSummaryName = '' } = {}) => {
  const multiline = isMultilineOrder(order);

  return {
    ...(order.currentData || {}),
    name: multiline ? multilineSummaryName : resolveOrderProductName(order),
    brand: multiline ? '' : resolveOrderSnapshotField(order, 'brand'),
    series: multiline ? '' : resolveOrderSnapshotField(order, 'series'),
    sku: multiline ? '' : resolveOrderSnapshotField(order, 'sku'),
    size: multiline ? '' : resolveOrderSnapshotField(order, 'size'),
    color: multiline ? '' : resolveOrderSnapshotField(order, 'color'),
    material: multiline ? '' : resolveOrderSnapshotField(order, 'material'),
    remark: resolveOrderSnapshotField(order, 'remark'),
    deadline: resolveOrderSnapshotField(order, 'deadline'),
  };
};
