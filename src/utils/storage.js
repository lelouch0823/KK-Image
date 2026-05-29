/**
 * localStorage 通用工具
 * 提供安全的 localStorage 读写和历史记录管理
 */

/**
 * 安全读取 localStorage
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function storageGet(key, defaultValue = null) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 安全写入 localStorage
 * @param {string} key
 * @param {*} value
 */
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded or private mode */ }
}

/**
 * 安全删除 localStorage
 * @param {string} key
 */
export function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * 向列表头部添加值（去重、截断）
 * @param {string[]} list - 原列表
 * @param {string} value - 新值
 * @param {number} maxItems - 最大数量
 * @returns {string[]} 新列表
 */
export function addToHistoryList(list, value, maxItems = 5) {
  if (!value || typeof value !== 'string') return list;
  const trimmed = value.trim();
  if (!trimmed) return list;
  const filtered = list.filter((item) => item !== trimmed);
  filtered.unshift(trimmed);
  return filtered.slice(0, maxItems);
}
