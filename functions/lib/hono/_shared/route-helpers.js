/**
 * 路由层公共辅助函数
 * @module lib/hono/_shared/route-helpers
 */

/**
 * 从请求中解析分页参数
 * @param {Object} c - Hono context
 * @param {{ page?: number, limit?: number }} defaults - 默认值
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function parsePagination(c, { page: defaultPage = 1, limit: defaultLimit = 20 } = {}) {
  const page = Math.max(1, parseInt(c.req.query('page') || String(defaultPage), 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || String(defaultLimit), 10)));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * 缓存失效 URL 工厂
 * @param {string} basePath - API 路径，如 '/api/manage/customers'
 * @param {string[]} extraParams - 额外的查询参数变体
 * @returns {(c: Object) => string[]}
 */
export function createCacheInvalidator(basePath, extraParams = []) {
  return (c) => {
    const origin = new URL(c.req.url).origin;
    return [
      `${origin}${basePath}`,
      ...extraParams.map((p) => `${origin}${basePath}?${p}`),
    ];
  };
}
