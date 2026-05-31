/**
 * localStorage 通用工具
 * 提供安全的 localStorage 读写和历史记录管理
 */

/**
 * 安全读取 localStorage
 */
export function storageGet<T = unknown>(key: string, defaultValue: T | null = null): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 安全写入 localStorage
 */
export function storageSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded or private mode */ }
}

/**
 * 安全删除 localStorage
 */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * 向列表头部添加值（去重、截断）
 */
export function addToHistoryList(list: string[], value: unknown, maxItems: number = 5): string[] {
  if (!value || typeof value !== 'string') return list;
  const trimmed = value.trim();
  if (!trimmed) return list;
  const filtered = list.filter((item) => item !== trimmed);
  filtered.unshift(trimmed);
  return filtered.slice(0, maxItems);
}
