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

    // 分享
    SHARES: `${API_PREFIX}/shares`,

    // 空间
    SPACES: `${API_PREFIX}/spaces`,
    SPACE_BY_ID: (id) => `${API_PREFIX}/spaces/${id}`,
    SPACE_FILES: (id) => `${API_PREFIX}/spaces/${id}/files`,
    SPACE_STATS: (id) => `${API_PREFIX}/spaces/${id}/stats`,

    // 公开访问
    PUBLIC_GALLERY: (token) => `/api/gallery/${token}`,
    PUBLIC_SPACE: (token) => `/api/space/${token}`,

    // 统计
    STATS: `${API_PREFIX}/stats`,

    // 文件操作
    MOVE: `${API_PREFIX}/move`,

    // 认证
    LOGIN: `${API_PREFIX}/login`,
    LOGOUT: `${API_PREFIX}/logout`,
    USER: `${API_PREFIX}/user`
};

// 前端路由 (用于跳转和生成分享链接)
export const ROUTES = {
    GALLERY: (token) => `/gallery/${token}`,
    SPACE: (token) => `/space/${token}`,
    FILE: (id) => `/file/${id}`
};

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const DASHBOARD_LIMIT = 10;
