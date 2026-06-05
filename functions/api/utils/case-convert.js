/**
 * 命名风格转换工具 (Case Conversion Utilities)
 * =============================================
 *
 * 提供 snake_case <-> camelCase 的对象键名转换。
 * 用于 Repository 层返回数据库行时统一转换键名风格。
 *
 * @module api/utils/case-convert
 */

/**
 * 将单个 snake_case 键名转为 camelCase
 * @param {string} key - snake_case 键名
 * @returns {string} camelCase 键名
 * @example
 * toCamelKey('created_at') // 'createdAt'
 * toCamelKey('id') // 'id'
 * toCamelKey('order_no') // 'orderNo'
 */
export function toCamelKey(key) {
    return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 将单个对象的键名从 snake_case 转为 camelCase
 * @param {Object} row - 数据库行对象
 * @returns {Object} 键名为 camelCase 的新对象
 * @example
 * toCamelCase({ created_at: 123, order_no: 'ORD-001' })
 * // { createdAt: 123, orderNo: 'ORD-001' }
 */
export function toCamelCase(row) {
    if (!row) return row;
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [toCamelKey(key), value])
    );
}

/**
 * 批量转换数组中的对象键名为 camelCase
 * @param {Array<Object>} rows - 数据库行数组
 * @returns {Array<Object>} 键名为 camelCase 的新数组
 * @example
 * toCamelCaseRows([{ created_at: 123 }, { created_at: 456 }])
 * // [{ createdAt: 123 }, { createdAt: 456 }]
 */
export function toCamelCaseRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(toCamelCase);
}

/**
 * 将单个 camelCase 键名转为 snake_case
 * @param {string} key - camelCase 键名
 * @returns {string} snake_case 键名
 * @example
 * toSnakeKey('createdAt') // 'created_at'
 * toSnakeKey('id') // 'id'
 */
export function toSnakeKey(key) {
    return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * 将单个对象的键名从 camelCase 转为 snake_case
 * @param {Object} obj - camelCase 对象
 * @returns {Object} 键名为 snake_case 的新对象
 * @example
 * toSnakeCase({ createdAt: 123, orderNo: 'ORD-001' })
 * // { created_at: 123, order_no: 'ORD-001' }
 */
export function toSnakeCase(obj) {
    if (!obj) return obj;
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [toSnakeKey(key), value])
    );
}

/**
 * 批量转换数组中的对象键名为 snake_case
 * @param {Array<Object>} rows - 对象数组
 * @returns {Array<Object>} 键名为 snake_case 的新数组
 */
export function toSnakeCaseRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(toSnakeCase);
}
