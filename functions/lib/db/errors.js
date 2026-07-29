/**
 * D1/SQLite 错误判断工具
 *
 * 统一处理 D1 常见错误类型，避免各 Repository 重复实现。
 *
 * @module lib/db/errors
 */

/**
 * 判断是否为 UNIQUE 约束冲突错误
 * @param {unknown} error - 捕获的异常
 * @returns {boolean}
 */
export function isUniqueConstraintError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('unique constraint failed') || msg.includes('constraint failed');
}

/**
 * 判断是否为缺少列错误（schema 迁移期间的容错）
 * @param {unknown} error - 捕获的异常
 * @param {string[]} columns - 要检查的列名列表，空数组表示匹配任意列
 * @returns {boolean}
 */
export function isMissingColumnError(error, columns = []) {
  const msg = String(error?.message || '').toLowerCase();
  if (!msg.includes('no such column')) return false;
  if (!columns || columns.length === 0) return true;
  return columns.some((column) => msg.includes(String(column).toLowerCase()));
}

/**
 * 判断是否为外键约束错误
 * @param {unknown} error - 捕获的异常
 * @returns {boolean}
 */
export function isForeignKeyError(error) {
  return String(error?.message || '').toLowerCase().includes('foreign key');
}

/**
 * 判断是否为 NOT NULL 约束错误
 * @param {unknown} error - 捕获的异常
 * @returns {boolean}
 */
export function isNotNullError(error) {
  return String(error?.message || '').toLowerCase().includes('not null');
}
