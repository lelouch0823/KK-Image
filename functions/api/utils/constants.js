/**
 * @fileoverview 后端常量定义
 * 统一管理魔法数值，避免硬编码
 */

// Webhook 配置
export const WEBHOOK_TIMEOUT_MS = 30000;
export const MAX_WEBHOOK_RETRIES = 3;

// CORS 配置
export const CORS_MAX_AGE = 86400;

// Token 配置
export const SHARE_TOKEN_LENGTH = 12;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
// 订单状态列表
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'production',
  'shipping',
  'arrived',
  'delivered',
  'void',
];

// 订单列表进度状态选项
export const ORDER_PROCUREMENT_STATUSES = [
  'none',
  'planned',
  'ordered',
  'partially_arrived',
  'arrived',
  'unprocured',
  'partially_procured',
  'fully_procured',
  'partially_received',
  'ready',
  'partially_shipped',
  'completed',
  'cancelled',
];
