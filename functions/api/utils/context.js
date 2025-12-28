/**
 * Context 工具函数
 * 用于统一获取和处理 Cloudflare Pages Functions 的 context 数据
 */

/**
 * 从 context 中获取用户信息
 * @param {Object} context - Cloudflare Pages context 对象
 * @returns {Object} 用户对象，如果未认证则返回匿名用户
 */
export function getUser(context) {
    return context.data?.user || context.user || { id: 'anonymous', name: 'anonymous' };
}
