/**
 * 路由层公共辅助函数
 * @module lib/hono/_shared/route-helpers
 */
import { inClause } from '../../../api/utils/sql.js';
import { parseRepoPagination } from '../../../api/utils/pagination.js';
import { invalidateCache } from '../middleware/cache.js';

/**
 * 从请求中解析分页参数
 * @param {Object} c - Hono context
 * @param {{ page?: number, limit?: number }} defaults - 默认值
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function parsePagination(c, { page: defaultPage = 1, limit: defaultLimit = 20 } = {}) {
  return parseRepoPagination(
    { page: c.req.query('page'), limit: c.req.query('limit') },
    { defaultPage, defaultLimit, maxLimit: 100 }
  );
}

/**
 * 在可选字段存在时追加 SQL 更新片段和值
 * @param {string[]} updates
 * @param {any[]} values
 * @param {string} assignment - SQL 赋值片段，如 "name = ?"
 * @param {any} value - 输入值；为 undefined 时不追加
 * @param {(value: any) => any} transform - 入库前转换
 * @returns {boolean} 是否发生追加
 */
export function appendOptionalUpdate(updates, values, assignment, value, transform = (next) => next) {
  if (value === undefined) return false;
  updates.push(assignment);
  values.push(transform(value));
  return true;
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

/**
 * 根据销售员 ID 列表查询 access_token（用于 token 级缓存失效）
 * @param {D1Database} db
 * @param {string[]} salespersonIds
 * @returns {Promise<string[]>}
 */
export async function getSalespersonAccessTokens(db, salespersonIds = []) {
  if (!db || typeof db.prepare !== 'function') return [];

  const ids = [...new Set((salespersonIds || []).filter(Boolean))];
  if (ids.length === 0) return [];

  try {
    const query = `SELECT access_token FROM salespersons WHERE id IN ${inClause(ids)} AND access_token IS NOT NULL`;
    const prepared = db.prepare(query);
    if (!prepared || typeof prepared.bind !== 'function') return [];

    const bound = prepared.bind(...ids);
    if (!bound || typeof bound.all !== 'function') return [];

    const { results = [] } = await bound.all();
    return [...new Set(results.map((row) => row.access_token).filter(Boolean))];
  } catch {
    return [];
  }
}

/**
 * 查询全部销售 access_token（用于无法确定单一 token 的跨端缓存失效）
 * @param {D1Database} db
 * @returns {Promise<string[]>}
 */
export async function getAllSalespersonAccessTokens(db) {
  if (!db || typeof db.prepare !== 'function') return [];

  try {
    const query = 'SELECT access_token FROM salespersons WHERE access_token IS NOT NULL';
    const prepared = db.prepare(query);
    if (!prepared || typeof prepared.all !== 'function') return [];

    const { results = [] } = await prepared.all();
    return [...new Set(results.map((row) => row.access_token).filter(Boolean))];
  } catch {
    return [];
  }
}

/**
 * 异步调度缓存失效任务
 * @param {Object} c - Hono context
 * @param {string|string[]} urls - 待失效 URL
 */
export function scheduleCacheInvalidation(c, urls) {
  c.executionCtx.waitUntil(invalidateCache(urls));
}
