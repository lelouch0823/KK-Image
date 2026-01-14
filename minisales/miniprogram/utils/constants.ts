/**
 * API 常量定义
 */

// 开发环境: 使用本地 wrangler 服务器
// 生产环境: 请替换为您的实际域名
// 注意: 微信开发者工具中需要在 "详情" -> "本地设置" 勾选 "不校验合法域名"
export const API_BASE_URL = 'http://127.0.0.1:8080';

// API 端点
export const API = {
    // 微信登录
    WECHAT_LOGIN: '/api/sales/wechat-login',

    // 用户名/密码登录 (小程序专用)
    SALES_LOGIN: '/api/sales/login',

    // 销售端 API (需要 token 参数)
    SALES_AUTH: (token: string) => `/api/sales/${token}/auth`,
    SALES_ORDERS: (token: string) => `/api/sales/${token}/orders`,
    SALES_ORDER_DETAIL: (token: string, id: string) => `/api/sales/${token}/orders/${id}`,
    SALES_ORDER_COMMENT: (token: string, id: string) => `/api/sales/${token}/orders/${id}/comment`,
    SALES_UPLOAD: (token: string) => `/api/sales/${token}/upload`,
    SALES_STATS: (token: string) => `/api/sales/${token}/stats`,
    SALES_BIND_WECHAT: (token: string) => `/api/sales/${token}/bind-wechat`,

    // 通知
    SALES_NOTIFICATIONS: (token: string) => `/api/sales/${token}/notifications`,
    SALES_NOTIFICATIONS_READ: (token: string, id: string) => `/api/sales/${token}/notifications/${id}/read`,
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

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// 状态显示配置
export const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
    pending: { label: '待确认', color: '#f59e0b', bgColor: '#fef3c7' },
    confirmed: { label: '已确认', color: '#3b82f6', bgColor: '#dbeafe' },
    rejected: { label: '已驳回', color: '#ef4444', bgColor: '#fee2e2' },
    production: { label: '生产中', color: '#8b5cf6', bgColor: '#ede9fe' },
    shipping: { label: '已发货', color: '#06b6d4', bgColor: '#cffafe' },
    arrived: { label: '已到店', color: '#10b981', bgColor: '#d1fae5' },
    delivered: { label: '已交付', color: '#22c55e', bgColor: '#dcfce7' },
    void: { label: '已作废', color: '#6b7280', bgColor: '#f3f4f6' },
};

// 存储 Key
export const STORAGE_KEYS = {
    TOKEN: 'sales_token',
    ACCESS_TOKEN: 'access_token', // URL 中的 token
    USER_INFO: 'user_info',
};
