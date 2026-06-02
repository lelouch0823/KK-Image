import type { SalesOrdersPageData } from '../../services/sales/orders';
import type { NormalizedSalesOrderSummary } from '../../utils/normalize/order';
import { STATUS_CONFIG } from '../../utils/constants';

export type OrderSummary = NormalizedSalesOrderSummary;
export type OrdersPagePayload = SalesOrdersPageData;

export interface StatusFilterOption {
  key: string;
  label: string;
}

export const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { key: '', label: '全部' },
  ...Object.entries(STATUS_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
  })),
];

export function buildOrdersListState(
  existing: OrderSummary[],
  payload: OrdersPagePayload,
  append = false
) {
  const nextOrders = append ? [...existing, ...payload.orders] : payload.orders;
  return {
    orders: nextOrders,
    pagination: payload.pagination,
    canLoadMore: payload.pagination.page < payload.pagination.totalPages,
  };
}

export function filterOrdersBySearch(orders: OrderSummary[], query: string): OrderSummary[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return orders;
  }

  return orders.filter((item) => {
    const orderNo = String(item.orderNo || '').toLowerCase();
    const title = String(item.title || '').toLowerCase();
    return orderNo.includes(keyword) || title.includes(keyword);
  });
}

export function filterOrdersByStatus(orders: OrderSummary[], status: string): OrderSummary[] {
  if (!status) {
    return orders;
  }
  return orders.filter((item) => item.status === status);
}
