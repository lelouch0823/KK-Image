/**
 * @fileoverview 通用工具函数模块
 * 统一的 ID 生成、时间戳、令牌生成等
 */

// ==================== ID 生成 ====================

/**
 * 生成标准 UUID
 * @returns {string} UUID v4 格式
 */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * 生成带前缀的 ID
 * @param {string} prefix - 前缀 (如 'wh_', 'log_', 'usr_')
 * @returns {string}
 */
export function generatePrefixedId(prefix) {
  return prefix + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * 生成随机分享令牌
 * @param {number} [length=12] - 令牌长度
 * @returns {string}
 */
export function generateShareToken(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // 使用拒绝采样避免模偏差
  const result = [];
  while (result.length < length) {
    const array = new Uint8Array(length * 2);
    crypto.getRandomValues(array);
    for (const byte of array) {
      if (byte < 248) { // 248 = 62 * 4，拒绝 248-255 避免模偏差
        result.push(chars[byte % 62]);
        if (result.length === length) break;
      }
    }
  }
  return result.join('');
}

// ==================== 时间戳 ====================

/**
 * 获取当前时间戳 (毫秒)
 * @returns {number}
 */
export function now() {
  return Date.now();
}

/**
 * 将 ISO 字符串转换为时间戳
 * @param {string} isoString - ISO 8601 格式字符串
 * @returns {number|null}
 */
export function isoToTimestamp(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * 将时间戳转换为 ISO 字符串
 * @param {number} timestamp - 时间戳 (毫秒)
 * @returns {string}
 */
export function timestampToIso(timestamp) {
  return new Date(timestamp).toISOString();
}

// ==================== 密码哈希 ====================

const PASSWORD_HASH_VERSION = 'pbkdf2$sha256';
const PASSWORD_ITERATIONS = 210000;
const PASSWORD_SALT_BYTES = 16;

function bytesToBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function constantTimeEqualBytes(left, right) {
  const a = left instanceof Uint8Array ? left : new Uint8Array(left);
  const b = right instanceof Uint8Array ? right : new Uint8Array(right);
  if (a.length !== b.length) {
    let _mismatch = a.length ^ b.length;
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i += 1) {
      _mismatch |= (a[i] || 0) ^ (b[i] || 0);
    }
    return false;
  }
  if (crypto.subtle.timingSafeEqual) {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

async function derivePasswordBytes(password, pepper, saltBytes, iterations = PASSWORD_ITERATIONS) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${password}\u0000${pepper}`),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    keyMaterial,
    256
  );
  return new Uint8Array(derived);
}

function parsePasswordHashRecord(encodedHash) {
  const normalized = String(encodedHash || '').trim();
  if (!normalized.startsWith(`${PASSWORD_HASH_VERSION}$`)) {
    return null;
  }
  const parts = normalized.split('$');
  if (parts.length !== 5) {
    return null;
  }
  const iterations = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return null;
  }
  return {
    iterations,
    salt: parts[3],
    hash: parts[4],
  };
}

export function passwordHashNeedsMigration(encodedHash) {
  return !parsePasswordHashRecord(encodedHash);
}

/**
 * 生成密码哈希
 * @param {string} password - 原始密码
 * @param {string} pepper - 应用级 pepper（必需，建议使用 JWT_SECRET）
 * @returns {Promise<string>}
 */
export async function hashPassword(password, pepper) {
  if (!pepper) {
    throw new Error('Salt is required for password hashing');
  }
  const saltBytes = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const derived = await derivePasswordBytes(password, pepper, saltBytes, PASSWORD_ITERATIONS);
  return [
    PASSWORD_HASH_VERSION,
    String(PASSWORD_ITERATIONS),
    bytesToBase64Url(saltBytes),
    bytesToBase64Url(derived),
  ].join('$');
}

/**
 * 校验密码哈希
 * @param {string} password
 * @param {string} encodedHash
 * @param {string} pepper
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, encodedHash, pepper) {
  if (!pepper || !encodedHash) return false;

  const parsed = parsePasswordHashRecord(encodedHash);
  if (!parsed) {
    const legacyHash = await sha256Hex(`${password}${pepper}`);
    const left = new TextEncoder().encode(legacyHash);
    const right = new TextEncoder().encode(String(encodedHash));
    return constantTimeEqualBytes(left, right);
  }

  const derived = await derivePasswordBytes(
    password,
    pepper,
    base64UrlToBytes(parsed.salt),
    parsed.iterations
  );
  return constantTimeEqualBytes(derived, base64UrlToBytes(parsed.hash));
}

// ==================== HMAC 签名 ====================

/**
 * 生成 HMAC-SHA256 签名
 * @param {string} payload - 待签名内容
 * @param {string} secret - 密钥
 * @returns {Promise<string>}
 */
export async function generateHmacSignature(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ==================== URL 验证 ====================

/**
 * 验证 URL 格式
 * @param {string} urlString - URL 字符串
 * @returns {boolean}
 */
export function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
/**
 * 生成订单编号
 * 格式: ORD-YYMMDD-HHmmss-XXX
 * @returns {string}
 */
export function generateOrderNo() {
  const now = new Date();
  // 日期: YYMMDD
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
  // 时间: HHmmss (使用 UTC 保持一致性)
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const mins = String(now.getUTCMinutes()).padStart(2, '0');
  const secs = String(now.getUTCSeconds()).padStart(2, '0');
  const timePart = `${hours}${mins}${secs}`;
  // 随机: 3位大写字母+数字（使用 crypto 避免碰撞）
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  const random = ((bytes[0] << 8) | bytes[1]).toString(36).toUpperCase().padStart(3, '0').slice(-3);
  return `ORD-${datePart}-${timePart}-${random}`;
}

// ==================== SHA-256 哈希 ====================

/**
 * 计算 SHA-256 哈希并返回十六进制字符串
 * @param {string|ArrayBuffer|Uint8Array} data - 待哈希内容
 * @returns {Promise<string>} 十六进制哈希值
 */
export async function sha256Hex(data) {
  const encoder = new TextEncoder();
  const buffer = typeof data === 'string' ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
