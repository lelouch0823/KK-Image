/**
 * 安全转换为有限数值
 * @param {*} value - 待转换值
 * @param {number} [fallback=0] - 非有限值时的回退值
 * @returns {number}
 */
export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 安全转换为非负整数
 * @param {*} value - 待转换值
 * @returns {number} 非负数值（最小为 0）
 */
export function toNonNegativeInt(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.trunc(numberValue));
}

/**
 * 安全转换为非负有限数值
 * @param {*} value - 待转换值
 * @param {number} [fallback=0] - 非有限或负值时的回退值
 * @returns {number}
 */
export function toNonNegativeNumber(value, fallback = 0) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) return fallback;
  return normalized;
}
