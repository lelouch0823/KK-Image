/**
 * @fileoverview 统一的加密工具函数
 * 消除 auth.js / id.js / s3.js / ErpSyncService.js / cron-auth.js / OAuthRepository.js 中的重复实现
 *
 * @module api/utils/crypto
 */

// ==================== Base64URL 编解码 ====================

/**
 * Base64URL 编码（支持 Unicode 字符串）
 * @param {string|object} data - 字符串或可 JSON 序列化的对象
 * @returns {string} Base64URL 编码字符串
 */
export function base64UrlEncode(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const encoded = btoa(unescape(encodeURIComponent(str)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL 解码为字符串（支持 Unicode）
 * @param {string} str - Base64URL 编码字符串
 * @returns {string} 解码后的字符串
 */
export function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return decodeURIComponent(escape(atob(base64)));
}

/**
 * Base64URL 编码 Uint8Array
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Base64URL 解码为 Uint8Array
 * @param {string} value
 * @returns {Uint8Array}
 */
export function base64UrlToBytes(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// ==================== 恒定时间比较 ====================

/**
 * 恒定时间字节比较（Uint8Array 或字符串）
 * 优先使用 Cloudflare Workers 原生 timingSafeEqual
 * @param {Uint8Array|string} left
 * @param {Uint8Array|string} right
 * @returns {boolean}
 */
export function timingSafeEqual(left, right) {
  const a = left instanceof Uint8Array ? left : new TextEncoder().encode(String(left));
  const b = right instanceof Uint8Array ? right : new TextEncoder().encode(String(right));
  if (a.length !== b.length) return false;
  if (crypto.subtle.timingSafeEqual) {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

/**
 * 恒定时间字符串比较（防时序攻击）
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return timingSafeEqual(a, b);
}

// ==================== HMAC-SHA256 ====================

/**
 * HMAC-SHA256 签名，返回 Uint8Array
 * @param {string|Uint8Array} key - 密钥
 * @param {string} data - 待签名数据
 * @returns {Promise<Uint8Array>}
 */
export async function hmacSha256(key, data) {
  const encoder = new TextEncoder();
  const keyData = key instanceof Uint8Array ? key : encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)));
}

/**
 * HMAC-SHA256，返回 hex 字符串
 * @param {string|Uint8Array} key
 * @param {string} data
 * @returns {Promise<string>}
 */
export async function hmacSha256Hex(key, data) {
  const bytes = await hmacSha256(key, data);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC-SHA256，返回 URL-safe Base64 字符串
 * @param {string} key
 * @param {string} data
 * @returns {Promise<string>}
 */
export async function hmacSha256Base64Url(key, data) {
  const bytes = await hmacSha256(key, data);
  return bytesToBase64Url(bytes);
}

// ==================== SHA-256 ====================

/**
 * SHA-256 哈希，返回 hex 字符串
 * @param {string|ArrayBuffer|Uint8Array} data
 * @returns {Promise<string>}
 */
export async function sha256Hex(data) {
  const encoder = new TextEncoder();
  const buffer = typeof data === 'string' ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
