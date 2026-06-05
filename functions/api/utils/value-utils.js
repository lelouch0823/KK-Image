/**
 * 检查值是否为空
 * 支持 undefined / null / 空字符串 / 空数组 / 空对象
 * @param {*} value
 * @returns {boolean}
 */
export const isEmptyValue = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};
