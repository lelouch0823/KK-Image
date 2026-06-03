/**
 * 对象工具函数
 */

/**
 * 判断对象是否包含可枚举属性
 * 替代 Object.keys(obj).length > 0 模式
 */
export function hasEntries(obj: unknown): boolean {
  return obj != null && typeof obj === 'object' && Object.keys(obj).length > 0;
}
