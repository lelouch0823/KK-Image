/**
 * 公共常量定义
 * @module utils/constants
 */

// 应用名称 (用于页面标题等)
export const APP_NAME = 'kk-life';

// 图片文件扩展名
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];

// 可压缩文件扩展名
export const COMPRESSIBLE_EXTENSIONS = ['js', 'css', 'html', 'json', 'xml', 'svg'];

// 静态资源扩展名
export const STATIC_EXTENSIONS = [
  'js',
  'css',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'ico',
];

// API 路径前缀
export const API_PREFIX = '/api/manage';

// API 端点
export const API = {
  // 文件夹
  FOLDERS: `${API_PREFIX}/folders`,
  FOLDER_BY_ID: (id) => `${API_PREFIX}/folders/${id}`,
  FOLDER_UPLOAD: (id) => `${API_PREFIX}/folders/${id}/upload`,

  // v1 API (RESTful)
  FILES: '/api/v1/files',

  // 分享
  SHARES: `${API_PREFIX}/shares`,

  // 空间
  SPACES: `${API_PREFIX}/spaces`,
  SPACE_BY_ID: (id) => `${API_PREFIX}/spaces/${id}`,
  SPACE_FILES: (id) => `${API_PREFIX}/spaces/${id}/files`,
  SPACE_STATS: (id) => `${API_PREFIX}/spaces/${id}/stats`,
  SPACE_SUBSPACES: (id) => `${API_PREFIX}/spaces/${id}/subspaces`,
  SPACE_BY_PRODUCT: (productId) => `${API_PREFIX}/spaces/product/${productId}`,

  // 公开访问
  PUBLIC_GALLERY: (token) => `/api/gallery/${token}`,
  PUBLIC_SPACE: (token) => `/api/space/${token}`,

  // 销售员管理
  SALESPERSONS: `${API_PREFIX}/salespersons`,

  // 统计
  STATS: `${API_PREFIX}/stats`,

  // 文件操作
  MOVE: `${API_PREFIX}/move`,
  MANAGE_UPLOAD: `${API_PREFIX}/upload`,
  CHECK_HASH: '/api/v1/files/check-hash', // 原始文件 hash 预检查

  // 回收站
  TRASH: `${API_PREFIX}/trash`,
  TRASH_RESTORE: `${API_PREFIX}/trash/restore`,
  TRASH_DELETE: `${API_PREFIX}/trash/delete`, // Permanent delete specific items
  TRASH_EMPTY: `${API_PREFIX}/trash/empty`,

  // 认证
  LOGIN: '/api/v1/auth/login',
  LOGOUT: '/api/v1/auth/logout',
  USER: '/api/v1/auth/me',
  PERMISSIONS: '/api/v1/permissions',
  PERMISSIONS_USER: '/api/v1/permissions/user',
  PERMISSIONS_CHECK: '/api/v1/permissions/check',

  // 销售端订单 API (公开，Token 鉴权)
  SALES_AUTH: (token) => `/api/sales/${token}/auth`,
  SALES_ORDER_LIST: (token) => `/api/sales/${token}/orders`,
  SALES_ORDER_CREATE: (token) => `/api/sales/${token}/orders`,
  SALES_ORDER_DETAIL: (token, id) => `/api/sales/${token}/orders/${id}`,
  SALES_ORDER_COMMENT: (token, id) => `/api/sales/${token}/orders/${id}/comment`,
  SALES_ORDER_READ: (token, id) => `/api/sales/${token}/orders/${id}/read`,
  SALES_UPLOAD: (token) => `/api/sales/${token}/upload`,
  SALES_STATS: (token) => `/api/sales/${token}/stats`,
  SALES_SPACES: (token) => `/api/sales/${token}/spaces`,
  SALES_SPACE_DETAIL: (token, id) => `/api/sales/${token}/spaces/${id}`,
  SALES_PRODUCTS: (token) => `/api/sales/${token}/products`,
  SALES_PRODUCT_DETAIL: (token, id) => `/api/sales/${token}/products/${id}`,

  // 管理端订单 API
  MANAGE_ORDERS: `/api/manage/orders`,
  MANAGE_ORDER_BY_ID: (id) => `/api/manage/orders/${id}`,
  MANAGE_ORDER_UPDATE: (id) => `/api/manage/orders/${id}`,
  MANAGE_ORDER_STATUS: (id) => `/api/manage/orders/${id}/status`,
  MANAGE_ORDER_COMMENT: (id) => `/api/manage/orders/${id}/comment`,
  MANAGE_ORDER_LINE_RESERVE: (id, lineId) => `/api/manage/orders/${id}/lines/${lineId}/reserve`,
  MANAGE_ORDER_LINE_RELEASE: (id, lineId) => `/api/manage/orders/${id}/lines/${lineId}/release`,
  MANAGE_ORDER_LINE_SHIP: (id, lineId) => `/api/manage/orders/${id}/lines/${lineId}/ship`,
  MANAGE_ORDER_EXPORT: `${API_PREFIX}/orders/export`,
  MANAGE_DASHBOARD_STATS: '/api/manage/orders/stats',
  MANAGE_DASHBOARD_OVERVIEW: '/api/manage/dashboard/overview',
  MANAGE_ORDER_BATCH: `${API_PREFIX}/orders/batch`, // Kept this as it was not explicitly removed by the instruction
  MANAGE_CUSTOMERS: '/api/manage/customers',
  MANAGE_CUSTOMER: '/api/manage/customers',
  MANAGE_CUSTOMER_ORDERS: (id) => `/api/manage/customers/${id}/orders`,

  // 商品管理
  MANAGE_PRODUCTS: `${API_PREFIX}/products`,
  MANAGE_PRODUCT_BY_ID: (id) => `${API_PREFIX}/products/${id}`,

  // 订货总览
  MANAGE_GOODS_OVERVIEW: `${API_PREFIX}/goods-overview`,
  MANAGE_GOODS_OVERVIEW_SUMMARY: `${API_PREFIX}/goods-overview/summary`,
  MANAGE_GOODS_OVERVIEW_EXPORT: `${API_PREFIX}/goods-overview/export`,

  // 采购单管理
  MANAGE_PURCHASE_ORDERS: `${API_PREFIX}/purchase-orders`,
  MANAGE_PURCHASE_ORDER_BY_ID: (id) => `${API_PREFIX}/purchase-orders/${id}`,
  MANAGE_PURCHASE_ORDER_STATUS: (id) => `${API_PREFIX}/purchase-orders/${id}/status`,
  MANAGE_PURCHASE_ORDER_ITEMS: (id) => `${API_PREFIX}/purchase-orders/${id}/items`,
  MANAGE_PURCHASE_ORDER_ITEM: (id, itemId) => `${API_PREFIX}/purchase-orders/${id}/items/${itemId}`,
  MANAGE_PURCHASE_ORDER_RECEIPTS: (id) => `${API_PREFIX}/purchase-orders/${id}/receipts`,
  MANAGE_PURCHASE_ORDER_RECEIPT_REVERSAL: (id, receiptId) => `${API_PREFIX}/purchase-orders/${id}/receipts/${receiptId}/reversal`,
  MANAGE_PURCHASE_ORDER_SHORTAGE_CLOSURES: (id) => `${API_PREFIX}/purchase-orders/${id}/shortage-closures`,
  MANAGE_PURCHASE_ORDER_ALLOCATE: (id) => `${API_PREFIX}/purchase-orders/${id}/allocate`,
  MANAGE_PURCHASE_ORDER_FROM_ORDERS: `${API_PREFIX}/purchase-orders/from-orders`,
  MANAGE_PURCHASE_ORDER_SUGGESTIONS: `${API_PREFIX}/purchase-orders/suggestions`,
  MANAGE_PURCHASE_ORDER_STATS: `${API_PREFIX}/purchase-orders/stats`,

  MANAGE_OUTBOX: `${API_PREFIX}/outbox`,
  MANAGE_OUTBOX_BY_ID: (id) => `${API_PREFIX}/outbox/${id}`,
  MANAGE_AUDIT_REPLAY_DRY_RUN: `${API_PREFIX}/audit-replay/dry-run`,
  MANAGE_AUDIT_REPLAY_EXECUTE: `${API_PREFIX}/audit-replay/execute`,

  NOTIFICATIONS: '/api/manage/notifications',
  NOTIFICATIONS_READ: (id) => `/api/manage/notifications/${id}/read`,
  AI: {
    CHAT: '/api/manage/ai/chat',
    STREAM: '/api/manage/ai/stream',
    REPORT: '/api/manage/ai/report',
  },

  // 销售端通知 API
  SALES_NOTIFICATIONS: (token) => `/api/sales/${token}/notifications`,
  SALES_NOTIFICATIONS_READ: (token, id) => `/api/sales/${token}/notifications/${id}/read`,

  // 销售人员管理 API
  SALESPERSON_BY_ID: (id) => `${API_PREFIX}/salespersons/${id}`,
  SALESPERSON_RESET_TOKEN: (id) => `${API_PREFIX}/salespersons/${id}/reset-token`,

  // 其他
  TURNSTILE_VERIFY: '/api/turnstile/verify',
};

// 前端路由 (用于跳转和生成分享链接)
export const ROUTES = {
  GALLERY: (token) => `/gallery/${token}`,
  SPACE: (token) => `/space/${token}`,
  FILE: (id) => `/file/${id}`,
  SALES_PORTAL: (token) => `/sales/${token}`,
  ADMIN: '/admin',
};

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const SALES_ORDER_PAGE_SIZE = 20;
export const DASHBOARD_LIMIT = 10;
// 上传限制
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB (Cloudflare Workers Limit)
