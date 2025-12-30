/**
 * 日期相关工具函数
 */

/**
 * 获取今天的 ISO 日期字符串 (YYYY-MM-DD)
 * @returns {string} e.g. "2023-10-27"
 */
export function getTodayISOString() {
    return new Date().toISOString().split('T')[0];
}
