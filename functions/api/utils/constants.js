/**
 * @fileoverview 后端常量定义
 * 统一管理魔法数值，避免硬编码
 */

// CORS 配置
export const CORS_MAX_AGE = 86400;

// 订单状态列表
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'production',
  'shipping',
  'arrived',
  'fulfilled',
  'delivered',
  'void',
];

export const ORDER_FILTER_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'production',
  'shipping',
  'arrived',
  'fulfilled',
  'void',
];

export const ORDER_DELIVERY_STATUSES = [
  'not_shipped',
  'in_transit',
  'delivered',
  'partially_returned',
  'returned',
];

// 订单列表进度状态选项
export const ORDER_PROCUREMENT_STATUSES = [
  'unprocured',
  'planned',
  'ordered',
  'partially_procured',
  'fully_procured',
  'partially_received',
  'arrived',
  'ready',
  'partially_shipped',
  'completed',
  'cancelled',
];

const ORDER_PROCUREMENT_STATUS_ALIASES = Object.freeze({
  none: 'unprocured',
  partially_arrived: 'partially_received',
});

const ORDER_PROCUREMENT_STATUS_EXPANSIONS = Object.freeze({
  unprocured: ['unprocured', 'none'],
  partially_received: ['partially_received', 'partially_arrived'],
});

export function normalizeOrderProcurementStatus(status) {
  if (!status) return null;
  const normalized = ORDER_PROCUREMENT_STATUS_ALIASES[status] || status;
  return ORDER_PROCUREMENT_STATUSES.includes(normalized) ? normalized : null;
}

export function expandOrderProcurementStatusFilter(status) {
  const normalized = normalizeOrderProcurementStatus(status);
  if (!normalized) return [];
  return ORDER_PROCUREMENT_STATUS_EXPANSIONS[normalized] || [normalized];
}

export function normalizeOrderStatusFilter(status) {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  const canonical = normalized === 'delivered' ? 'fulfilled' : normalized;
  return ORDER_FILTER_STATUSES.includes(canonical) ? canonical : null;
}

export function expandOrderStatusFilter(status) {
  const normalized = normalizeOrderStatusFilter(status);
  if (!normalized) return [];
  if (normalized === 'fulfilled') return ['fulfilled', 'delivered'];
  return [normalized];
}

export function normalizeOrderDeliveryStatusFilter(status) {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  return ORDER_DELIVERY_STATUSES.includes(normalized) ? normalized : null;
}
