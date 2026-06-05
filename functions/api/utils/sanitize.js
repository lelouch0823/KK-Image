/**
 * 数据脱敏工具模块
 * 统一的敏感字段匹配模式和数据脱敏逻辑
 */

/**
 * 敏感字段匹配模式
 * 匹配 password、token、secret、cookie、authorization、jwt、api_key 等
 */
export const SENSITIVE_KEY_PATTERN = /password|token|secret|cookie|authorization|jwt|api[-_]?key/i;

/**
 * 部分脱敏字段匹配模式
 * 匹配 email、phone、mobile
 */
export const PARTIAL_MASK_PATTERN = /email|phone|mobile/i;

const REDACTED = '[REDACTED]';

/**
 * 对值进行部分脱敏（邮箱、手机号等）
 */
export function maskPartialValue(value) {
  if (typeof value !== 'string' || value.length < 3) return REDACTED;
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    const safeName = `${name.slice(0, 1)}***`;
    return `${safeName}@${domain}`;
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
