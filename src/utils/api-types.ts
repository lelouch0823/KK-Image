/**
 * API 共享类型定义
 *
 * 将 API 相关类型从 useResource 中提取到独立模块，
 * 消除 utils/ → composables/ 的反向依赖。
 */

/** 通用资源项基础约束：必须可索引访问 */
export interface ResourceItem {
    [key: string]: unknown;
}

/** API 通用响应结构 */
export interface ApiResponse {
    success: boolean;
    data?: unknown;
    error?: string;
    message?: string;
    pagination?: PaginationMeta;
    [key: string]: unknown;
}

/** 分页元数据 */
export interface PaginationMeta {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
}
