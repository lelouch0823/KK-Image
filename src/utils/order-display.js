export const resolveOrderProgressStatus = (order = {}) =>
  order.displayStatus || order.procurementStatus || 'none';

export const resolveOrderQuantity = (order = {}) => {
  const quantity = Number(order.quantity ?? order.currentData?.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

export const resolveOrderProductName = (order = {}) =>
  order.currentData?.name || order.lines?.[0]?.snapshotName || order.productName || '';
