/**
 * @fileoverview CSV 导出工具函数
 * 统一处理 CSV 字段转义和电子表格公式注入防护
 *
 * @module api/utils/csv
 */

/**
 * 中和电子表格公式注入
 * 对以 = + - @ 开头的值添加单引号前缀，防止公式执行
 * @param {*} value
 * @returns {string}
 */
export function neutralizeSpreadsheetFormula(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

/**
 * 转义 CSV 字段值
 * - 处理 null/undefined
 * - 中和电子表格公式注入
 * - 双引号转义
 * @param {*} value
 * @returns {string} 双引号包裹的转义后的字段值
 */
export function escapeCSV(value) {
  const normalized = neutralizeSpreadsheetFormula(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}
