/**
 * 将值转换为有限数，非有限时返回 fallback
 * @param value - 待转换的值
 * @param fallback - 非有限时的默认值（默认 0）
 */
export function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
