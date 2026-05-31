/** 订单行项目快照数据 */
interface OrderLineSnapshot {
  snapshotName?: string;
  [key: string]: unknown;
}

/** 订单当前/原始数据快照 */
interface OrderDataSnapshot {
  name?: string;
  quantity?: number;
  brand?: string;
  series?: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  remark?: string;
  deadline?: string;
  [key: string]: unknown;
}

/** 订单对象结构 */
export interface OrderForDisplay {
  displayStatus?: string;
  procurementStatus?: string;
  deliveryStatus?: string;
  quantity?: number;
  currentData?: OrderDataSnapshot;
  originalData?: OrderDataSnapshot;
  lines?: OrderLineSnapshot[];
  productName?: string;
  [key: string]: unknown;
}

/** 订单详情展示数据 */
export interface OrderDetailDisplayData {
  name?: string;
  brand?: string;
  series?: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  remark?: string;
  deadline?: string;
  [key: string]: unknown;
}

export const resolveOrderProgressStatus = (order: OrderForDisplay = {}): string =>
  order.displayStatus || order.procurementStatus || 'none';

export const resolveOrderDeliveryStatus = (order: OrderForDisplay = {}): string =>
  order.deliveryStatus || 'not_shipped';

export const resolveOrderQuantity = (order: OrderForDisplay = {}): number => {
  const quantity = Number(order.quantity ?? order.currentData?.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

export const resolveOrderProductName = (order: OrderForDisplay = {}): string =>
  order.currentData?.name || order.lines?.[0]?.snapshotName || order.productName || '';

export const isMultilineOrder = (order: OrderForDisplay = {}): boolean =>
  Array.isArray(order.lines) && order.lines.length > 1;

export const resolveHistoricalOrderProductName = (order: OrderForDisplay = {}): string =>
  order.lines?.[0]?.snapshotName || order.productName || order.currentData?.name || order.originalData?.name || '';

export const resolveOrderSnapshotField = (order: OrderForDisplay = {}, field: string = ''): string => {
  if (!field) return '';
  if (field === 'name') return resolveHistoricalOrderProductName(order);
  return (order.currentData?.[field] as string) || (order.originalData?.[field] as string) || '';
};

export const buildOrderDetailDisplayData = (order: OrderForDisplay = {}, { multilineSummaryName = '' }: { multilineSummaryName?: string } = {}): OrderDetailDisplayData => {
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
