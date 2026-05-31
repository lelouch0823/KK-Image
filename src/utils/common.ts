/**
 * 通用工具函数
 */

/**
 * 获取今天的 ISO 日期字符串 (YYYY-MM-DD)
 * @returns e.g. "2023-10-27"
 */
export function getTodayISOString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 生成随机 ID (用于本地临时数据)
 * @param prefix - ID 前缀
 */
export function generateRandomId(prefix: string = 'local'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
