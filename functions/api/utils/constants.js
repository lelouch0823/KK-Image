/**
 * @fileoverview 后端常量定义
 * 统一管理魔法数值，避免硬编码
 */

// 时间单位常量（毫秒）
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

// 时间单位常量（秒）
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_WEEK = 604_800;

// CORS 配置
export const CORS_MAX_AGE = 86400;

// D1 数据库操作限制
// D1 的 SQL IN 子句和 batch 操作的最大条目数
export const D1_MAX_IN_CLAUSE_SIZE = 100;
export const D1_MAX_BATCH_SIZE = 100;
export const D1_CHUNK_SIZE = 100;

// 分页默认值
export const DEFAULT_PAGE_LIMIT = 20;
export const LARGE_PAGE_LIMIT = 50;

// 缓存 TTL（秒）— 语义化分层
export const CACHE_TTL_REALTIME = 15;    // 高频变化数据（通知、回收站）
export const CACHE_TTL_SHORT = 20;       // 中频变化数据（仪表盘、采购单）
export const CACHE_TTL_MEDIUM = 30;      // 低频变化数据（列表、分类、开关）
export const CACHE_TTL_LONG = 60;        // 统计数据
export const CACHE_TTL_STATIC = 120;     // 低频统计数据（设置、上传趋势）

// JWT/Cookie 过期时间
export const JWT_EXPIRY_SECONDS = 7 * SECONDS_PER_WEEK;

// 限流默认参数
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 100;

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
