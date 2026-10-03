// 认证工具模块 - 处理 API Key 和 JWT 认证
import { parseJsonArray, safeJsonParse } from './json.js';
import { assertProductionSecret } from './secret-guard.js';
import {
  base64UrlEncode,
  base64UrlDecode,
  timingSafeCompare as cryptoTimingSafeCompare,
} from './crypto.js';

// 管理员认证 Cookie 名称
export const ADMIN_AUTH_COOKIE = 'ADMIN_AUTH';

// Global Cache for API Keys (Worker 内存缓存)
let cachedApiKeys = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 15 * 1000; // 15 seconds TTL - 安全敏感场景缩短缓存窗口
const DEFAULT_TURNSTILE_TIMEOUT_MS = 5000;

function resetApiKeyCache() {
  cachedApiKeys = null;
  lastCacheUpdate = 0;
}

/**
 * JWT 实现 - 使用 URL-safe Base64 (RFC 4648) 和安全比较
 */
class SimpleJWT {
  /**
   * 编码 JWT Token（异步方法）
   */
  static async encode(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(payload);

    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`, secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * 解码并验证 JWT Token（异步方法）
   */
  static async decode(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error(MSG.AUTH.JWT_INVALID);
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // 使用恒定时间比较防止时序攻击
    const expectedSignature = await this.sign(`${encodedHeader}.${encodedPayload}`, secret);
    if (!cryptoTimingSafeCompare(signature, expectedSignature)) {
      throw new Error(MSG.AUTH.JWT_INVALID);
    }

    // 解码载荷
    const payload = safeJsonParse(base64UrlDecode(encodedPayload));
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
      throw new Error(MSG.AUTH.JWT_INVALID);
    }

    // 检查过期时间
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error(MSG.AUTH.JWT_EXPIRED);
    }

    return payload;
  }

  /**
   * HMAC-SHA256 签名（返回 URL-safe Base64）
   */
  static async sign(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    // 转换为 URL-safe 格式
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

export async function generateScopedAccessToken(payload, env, expiresIn = 300) {
  if (!env?.JWT_SECRET) {
    throw new Error(MSG.AUTH.JWT_SECRET_MISSING);
  }
  const now = Math.floor(Date.now() / 1000);
  return SimpleJWT.encode(
    {
      ...payload,
      iat: now,
      exp: now + expiresIn,
    },
    env.JWT_SECRET
  );
}

export async function verifyScopedAccessToken(token, env, expectedType = null) {
  if (!env?.JWT_SECRET) {
    throw new Error(MSG.AUTH.JWT_SECRET_MISSING);
  }
  const payload = await SimpleJWT.decode(token, env.JWT_SECRET);
  if (expectedType && payload?.type !== expectedType) {
    throw new Error(MSG.AUTH.FORBIDDEN);
  }
  return payload;
}

// 验证 API Key
export async function verifyApiKey(apiKey, env) {
  if (!apiKey) {
    throw new Error(MSG.AUTH.API_KEY_REQUIRED);
  }

  // 从环境变量或 D1 存储中按 key 精确查找
  const keyInfo = await getValidApiKey(apiKey, env);
  if (!keyInfo) {
    throw new Error(MSG.AUTH.API_KEY_INVALID);
  }

  // 检查 API Key 是否过期
  if (keyInfo.expires_at && Date.now() > keyInfo.expires_at) {
    throw new Error(MSG.AUTH.API_KEY_EXPIRED);
  }

  // 检查 API Key 是否被禁用
  if (keyInfo.disabled) {
    throw new Error(MSG.AUTH.API_KEY_DISABLED);
  }

  // Parse permissions if string
  let permissions = keyInfo.permissions;
  if (typeof permissions === 'string') {
    permissions = parseJsonArray(permissions, []);
  }
  if (!Array.isArray(permissions)) permissions = [];

  return {
    id: keyInfo.id,
    name: keyInfo.name,
    permissions,
    type: 'api_key',
  };
}

// 验证 JWT Token
export async function verifyJWT(token, env) {
  if (!token) {
    throw new Error(MSG.AUTH.JWT_REQUIRED);
  }

  if (!env.JWT_SECRET) {
    throw new Error(MSG.AUTH.JWT_SECRET_MISSING);
  }

  // S-H1：生产环境拒绝使用仓库默认/弱密钥校验令牌（fail-closed），
  // 防止攻击者用公开默认值自签管理员 JWT
  assertProductionSecret(env, 'JWT_SECRET', env.JWT_SECRET);

  try {
    const payload = await SimpleJWT.decode(token, env.JWT_SECRET);

    return {
      id: payload.sub,
      name: payload.name,
      role: payload.role || (payload.type === 'admin' ? 'admin' : null),
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      type: payload.type || 'jwt',
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    throw new Error(`${MSG.AUTH.JWT_FAILED}: ${error.message}`);
  }
}

// 生成 JWT Token
export async function generateJWT(user, env, expiresIn = 3600) {
  if (!env.JWT_SECRET) {
    throw new Error(MSG.AUTH.JWT_SECRET_MISSING);
  }

  // S-H1：默认/弱密钥禁止在生产签发令牌（含 salesperson/文件签名 URL 等全部类型）
  assertProductionSecret(env, 'JWT_SECRET', env.JWT_SECRET);

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: user.id,
    name: user.name,
    type: user.type,
    role: user.role || (user.type === 'admin' ? 'admin' : null),
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    iat: now,
    exp: now + expiresIn,
  };

  return await SimpleJWT.encode(payload, env.JWT_SECRET);
}

// 获取单个有效 API Key (带内存缓存)
async function getValidApiKey(apiKey, env) {
  // 1. 检查内存缓存
  const now = Date.now();
  if (cachedApiKeys && now - lastCacheUpdate < CACHE_TTL && cachedApiKeys.has(apiKey)) {
    return cachedApiKeys.get(apiKey);
  }

  // 2. 尝试从 D1 数据库获取
  try {
    const row = await env.DB.prepare(
      'SELECT * FROM api_keys WHERE key_value = ? AND disabled = 0 LIMIT 1'
    )
      .bind(apiKey)
      .first();

    if (row) {
      const keyInfo = {
        ...row,
        key: row.key_value,
      };
      if (!cachedApiKeys || now - lastCacheUpdate >= CACHE_TTL) {
        cachedApiKeys = new Map();
      }
      cachedApiKeys.set(apiKey, keyInfo);
      lastCacheUpdate = now;
      return keyInfo;
    }

    if (!cachedApiKeys || now - lastCacheUpdate >= CACHE_TTL) {
      cachedApiKeys = new Map();
      lastCacheUpdate = now;
    }
    return null;
  } catch (error) {
    console.error('Failed to get API keys from D1:', error);
  }

  // 如果 KV/D1 中没有，使用环境变量中的默认 API Key（常量时间比较，防止时序侧信道）
  const defaultApiKey = env.DEFAULT_API_KEY;
  if (defaultApiKey && cryptoTimingSafeCompare(apiKey, defaultApiKey)) {
    return {
      id: 'default',
      key: defaultApiKey,
      name: 'Default API Key',
      permissions: [],
      created_at: Date.now(),
      disabled: 0,
    };
  }

  // 如果都没有，返回空
  return null;
}

export function __resetApiKeyCacheForTest() {
  resetApiKeyCache();
}

function createTimeoutSignal(timeoutMs = DEFAULT_TURNSTILE_TIMEOUT_MS) {
  const safeTimeout = Math.max(1, Number(timeoutMs) || DEFAULT_TURNSTILE_TIMEOUT_MS);
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(safeTimeout);
  }
  if (typeof AbortController === 'undefined') {
    return undefined;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), safeTimeout);
  timeout?.unref?.();
  return controller.signal;
}

// 验证 Cloudflare Turnstile
export async function verifyTurnstile(token, secret, { remoteIp = null, expectedHostname = null } = {}) {
  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  // S-L3：绑定解题者 IP，收窄令牌重放窗口
  if (remoteIp) formData.append('remoteip', remoteIp);
  const signal = createTimeoutSignal();

  try {
    const result = await fetch(url, {
      body: formData,
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    const outcome = await result.json();
    if (!outcome.success) return false;
    // S-L3：校验 hostname 与请求站点一致，防止其他站点签发的令牌跨站重放
    // （两侧均去掉端口；siteverify 未返回 hostname 时跳过）
    if (expectedHostname && outcome.hostname) {
      const stripPort = (host) => String(host).split(':')[0];
      if (stripPort(outcome.hostname) !== stripPort(expectedHostname)) return false;
    }
    return true;
  } catch (err) {
    console.error('Turnstile verification failed:', err);
    return false;
  }
}

import { parse as parseCookie } from 'cookie';
import { MSG } from './messages.js';

function normalizeAuthToken(token) {
  if (typeof token !== 'string') return token;
  return token.replace(/^"(.+)"$/, '$1');
}

function readBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return normalizeAuthToken(authHeader.substring(7));
  }
  return null;
}

export function extractRequestToken(
  request,
  { cookieName = null, preferBearer = false, includeBearer = true } = {}
) {
  const cookieToken = cookieName
    ? normalizeAuthToken(parseCookie(request.headers.get('Cookie') || '')[cookieName])
    : null;
  const bearerToken = includeBearer ? readBearerToken(request) : null;
  if (preferBearer) {
    return bearerToken || cookieToken;
  }
  return cookieToken || bearerToken;
}

export function extractAdminAuthToken(
  request,
  { preferBearer = false, includeBearer = true } = {}
) {
  return extractRequestToken(request, {
    cookieName: ADMIN_AUTH_COOKIE,
    preferBearer,
    includeBearer,
  });
}

/**
 * 验证管理员权限 (Middleware Helper)
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>} User payload
 */
export async function authenticateAdmin(request, env) {
  const token = extractAdminAuthToken(request);

  if (!token) {
    throw new Error(MSG.AUTH.REQUIRED);
  }

  try {
    const user = await verifyJWT(token, env);
    return user;
  } catch (_e) {
    throw new Error(MSG.AUTH.EXPIRED);
  }
}

/**
 * 常量时间密码比较 (防止时序攻击)
 * @param {string} a 第一个字符串
 * @param {string} b 第二个字符串
 * @returns {boolean}
 */
export { cryptoTimingSafeCompare as timingSafeCompare };

/**
 * 判断 JWT 载荷是否代表管理端身份。
 *
 * 同一个 JWT_SECRET 会签发多种令牌（admin/user 管理端、salesperson 销售端、
 * public_file_access 公开分享），仅凭签名通过不足以判定管理员身份 ——
 * 必须显式校验 type，否则销售人员/分享令牌将被当作管理员放行。
 * 遗留令牌（type 缺失或 'jwt'）与 Hono authMiddleware 的策略保持一致：拒绝。
 * @param {{ type?: string }} user - verifyJWT 返回的规范化载荷
 * @returns {boolean}
 */
export function isAdminUserContext(user) {
  return user?.type === 'admin' || user?.type === 'user';
}

/**
 * 检查请求是否来自已认证管理员（无抛错版本）
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<boolean>}
 */
export async function isAdminAuthenticated(request, env) {
  try {
    const token = extractAdminAuthToken(request);
    if (!token) return false;
    const user = await verifyJWT(token, env);
    return isAdminUserContext(user);
  } catch {
    return false;
  }
}
