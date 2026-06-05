/**
 * 中国时区日期 SQL 表达式
 *
 * 统一各 Repository / Service 中重复出现的 UTC+8 日期转换表达式，
 * 避免改一处漏十处。
 */

/**
 * 生成中国时区日期表达式（无表别名）
 * 例：DATE(created_at / 1000, 'unixepoch', '+8 hours')
 * @param {string} [col='created_at'] - 时间戳列名
 * @returns {string}
 */
export function chinaDateExpr(col = 'created_at') {
  return `DATE(${col} / 1000, 'unixepoch', '+8 hours')`;
}

/**
 * 生成中国时区日期表达式（带表别名）
 * 例：DATE(o.created_at / 1000, 'unixepoch', '+8 hours')
 * @param {string} alias - 表别名
 * @param {string} [col='created_at'] - 时间戳列名
 * @returns {string}
 */
export function chinaDateExprAliased(alias, col = 'created_at') {
  return `DATE(${alias}.${col} / 1000, 'unixepoch', '+8 hours')`;
}

/**
 * 生成中国时区小时表达式（无表别名）
 * 例：STRFTIME('%H', created_at / 1000, 'unixepoch', '+8 hours')
 * @param {string} [col='created_at'] - 时间戳列名
 * @returns {string}
 */
export function chinaHourExpr(col = 'created_at') {
  return `STRFTIME('%H', ${col} / 1000, 'unixepoch', '+8 hours')`;
}
