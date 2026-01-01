/**
 * 公共常量定义
 * @module utils/constants
 */

// 图片文件扩展名
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];

// 可压缩文件扩展名
export const COMPRESSIBLE_EXTENSIONS = ['js', 'css', 'html', 'json', 'xml', 'svg'];

// 静态资源扩展名
export const STATIC_EXTENSIONS = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'ico'];

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

    // 公开访问
    PUBLIC_GALLERY: (token) => `/api/gallery/${token}`,
    PUBLIC_SPACE: (token) => `/api/space/${token}`,

    // 统计
    STATS: `${API_PREFIX}/stats`,

    // 文件操作
    MOVE: `${API_PREFIX}/move`,
    MANAGE_UPLOAD: `${API_PREFIX}/upload`,
    CHECK_HASH: '/api/check-hash',  // 原始文件 hash 预检查 (无需 auth)

    // 认证
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    USER: '/api/v1/auth/me',

    // 销售端订单 API (公开，Token 鉴权)
    SALES_AUTH: (token) => `/api/sales/${token}/auth`,
    SALES_ORDER_LIST: (token) => `/api/sales/${token}/orders`,
    SALES_ORDER_CREATE: (token) => `/api/sales/${token}/orders`,
    SALES_ORDER_DETAIL: (token, id) => `/api/sales/${token}/orders/${id}`,
    SALES_ORDER_COMMENT: (token, id) => `/api/sales/${token}/orders/${id}/comment`,
    SALES_ORDER_READ: (token, id) => `/api/sales/${token}/orders/${id}/read`,
    SALES_UPLOAD: (token) => `/api/sales/${token}/upload`,
    SALES_STATS: (token) => `/api/sales/${token}/stats`,

    // 管理端订单 API
    MANAGE_ORDERS: `/api/manage/orders`,
    MANAGE_ORDER_BY_ID: (id) => `/api/manage/orders/${id}`,
    MANAGE_ORDER_UPDATE: (id) => `/api/manage/orders/${id}`,
    MANAGE_ORDER_STATUS: (id) => `/api/manage/orders/${id}/status`,
    MANAGE_ORDER_COMMENT: (id) => `/api/manage/orders/${id}/comment`,
    MANAGE_ORDER_EXPORT: `${API_PREFIX}/orders/export`,
    MANAGE_DASHBOARD_STATS: '/api/manage/orders/stats',
    MANAGE_DASHBOARD_OVERVIEW: '/api/manage/dashboard/overview',
    MANAGE_ORDER_BATCH: `${API_PREFIX}/orders/batch`, // Kept this as it was not explicitly removed by the instruction
    MANAGE_CUSTOMERS: '/api/manage/customers',
    MANAGE_CUSTOMER: '/api/manage/customers',
    MANAGE_CUSTOMER_ORDERS: (id) => `/api/manage/customers/${id}/orders`,
    NOTIFICATIONS: '/api/notifications',
    NOTIFICATIONS_READ: (id) => `/api/notifications/${id}/read`,

    // 销售人员管理 API
    SALESPERSONS: `${API_PREFIX}/salespersons`,
    SALESPERSON_BY_ID: (id) => `${API_PREFIX}/salespersons/${id}`,
    SALESPERSON_RESET_TOKEN: (id) => `${API_PREFIX}/salespersons/${id}/reset-token`,

    // 其他
    TURNSTILE_VERIFY: '/api/turnstile/verify'
};

// 前端路由 (用于跳转和生成分享链接)
export const ROUTES = {
    GALLERY: (token) => `/gallery/${token}`,
    SPACE: (token) => `/space/${token}`,
    FILE: (id) => `/file/${id}`,
    SALES_PORTAL: (token) => `/sales/${token}`,
    ADMIN: '/admin'
};

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const DASHBOARD_LIMIT = 10;
// 上传限制
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB (Cloudflare Workers Limit)
