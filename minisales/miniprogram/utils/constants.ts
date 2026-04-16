/**
 * API 常量定义
 */

// 开发环境: 使用本地 wrangler 服务器
// 生产环境: 请替换为您的实际域名
// 注意: 微信开发者工具中需要在 "详情" -> "本地设置" 勾选 "不校验合法域名"
export const API_BASE_URL = 'http://127.0.0.1:8080';

export const SALES_API = {
  login: '/api/sales/login',
  wechatLogin: '/api/sales/wechat-login',
  auth: (token: string) => `/api/sales/${token}/auth`,
  bindWechat: (token: string) => `/api/sales/${token}/bind-wechat`,
  orders: (token: string) => `/api/sales/${token}/orders`,
  orderById: (token: string, id: string) => `/api/sales/${token}/orders/${id}`,
  orderRead: (token: string, id: string) => `/api/sales/${token}/orders/${id}/read`,
  orderComment: (token: string, id: string) => `/api/sales/${token}/orders/${id}/comment`,
  upload: (token: string) => `/api/sales/${token}/upload`,
  products: (token: string) => `/api/sales/${token}/products`,
  productById: (token: string, id: string) => `/api/sales/${token}/products/${id}`,
  stats: (token: string) => `/api/sales/${token}/stats`,
  spaces: (token: string) => `/api/sales/${token}/spaces`,
  spaceById: (token: string, id: string) => `/api/sales/${token}/spaces/${id}`,
  notifications: (token: string) => `/api/sales/${token}/notifications`,
  notificationRead: (token: string, id: string) => `/api/sales/${token}/notifications/${id}/read`,
};

// Backward-compatible alias for current page/utils usage.
export const API = {
  WECHAT_LOGIN: SALES_API.wechatLogin,
  SALES_LOGIN: SALES_API.login,
  SALES_AUTH: SALES_API.auth,
  SALES_ORDERS: SALES_API.orders,
  SALES_ORDER_DETAIL: SALES_API.orderById,
  SALES_ORDER_COMMENT: SALES_API.orderComment,
  SALES_UPLOAD: SALES_API.upload,
  SALES_STATS: SALES_API.stats,
  SALES_BIND_WECHAT: SALES_API.bindWechat,
  SALES_NOTIFICATIONS: SALES_API.notifications,
  SALES_NOTIFICATIONS_READ: SALES_API.notificationRead,
  SALES_SPACES: SALES_API.spaces,
  SALES_SPACE_DETAIL: SALES_API.spaceById,
};

// 订单状态
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  PRODUCTION: 'production',
  SHIPPING: 'shipping',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  VOID: 'void',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_TONE = {
  neutral: 'neutral',
  warning: 'warning',
  info: 'info',
  primary: 'primary',
  success: 'success',
  danger: 'danger',
} as const;

export type OrderStatusTone = (typeof ORDER_STATUS_TONE)[keyof typeof ORDER_STATUS_TONE];

export interface OrderStatusConfig {
  label: string;
  tone: OrderStatusTone;
}

// 状态显示配置
export const STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  pending: { label: '待确认', tone: 'warning' },
  confirmed: { label: '已确认', tone: 'info' },
  rejected: { label: '已驳回', tone: 'danger' },
  production: { label: '生产中', tone: 'primary' },
  shipping: { label: '已发货', tone: 'info' },
  arrived: { label: '已到店', tone: 'success' },
  delivered: { label: '已交付', tone: 'success' },
  void: { label: '已作废', tone: 'neutral' },
};

const EXTRA_STATUS_CONFIG: Record<string, OrderStatusConfig> = {
  partially_received: { label: '部分到货', tone: 'warning' },
  received: { label: '已到货', tone: 'success' },
};

export function resolveStatusConfig(status?: string): OrderStatusConfig {
  if (!status) {
    return { label: '处理中', tone: 'neutral' };
  }

  return (
    STATUS_CONFIG[status as OrderStatus] ||
    EXTRA_STATUS_CONFIG[status] || {
      label: status,
      tone: 'neutral',
    }
  );
}

// 存储 Key
export const STORAGE_KEYS = {
  TOKEN: 'sales_token',
  ACCESS_TOKEN: 'access_token', // URL 中的 token
  USER_INFO: 'user_info',
};
