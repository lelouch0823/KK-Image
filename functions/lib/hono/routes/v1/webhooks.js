/**
 * v1/webhooks - 向后兼容薄代理
 *
 * 所有功能已合并到 manage/webhooks.js，此处仅做 re-export 以保持
 * /api/v1/webhooks 路径前缀的向后兼容。
 *
 * @deprecated 请使用 /api/manage/webhooks
 */
export { default, auditRouteDeclarations } from '../manage/webhooks.js';
