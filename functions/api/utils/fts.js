/** FTS5 表存在性缓存（模块级，跨 Repository 共享） */
const ftsCache = new Map();

/**
 * 清除 FTS5 缓存（测试用）
 */
export function clearFtsCache() {
  ftsCache.clear();
}

/**
 * 检查 FTS5 虚拟表是否存在（带模块级缓存）
 * @param {import('../../types/database.js').D1Database} db
 * @param {string} tableName FTS5 表名
 * @returns {Promise<boolean>}
 */
export async function checkFtsTable(db, tableName) {
  if (ftsCache.has(tableName)) return ftsCache.get(tableName);
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .bind(tableName)
      .first();
    const exists = !!row;
    ftsCache.set(tableName, exists);
    return exists;
  } catch {
    ftsCache.set(tableName, false);
    return false;
  }
}

/**
 * 转义 FTS5 特殊字符，防止 MATCH 注入
 * FTS5 特殊字符: " * ( ) ^ - + : OR AND NOT NEAR
 * @param {string} input
 * @returns {string}
 */
export function sanitizeFts5Query(input) {
  const sanitized = String(input || '')
    .replace(/["*^()\-+:]/g, ' ')
    .replace(/\b(OR|AND|NOT|NEAR)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized;
}
