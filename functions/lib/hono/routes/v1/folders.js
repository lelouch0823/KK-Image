/**
 * v1/folders - 向后兼容薄代理
 *
 * 所有功能已合并到 manage/folders.js，此处仅做 re-export 以保持
 * /api/v1/folders 路径前缀的向后兼容。
 *
 * @deprecated 请使用 /api/manage/folders
 */
export { default, auditRouteDeclarations } from '../manage/folders.js';
