/**
 * 认证辅助函数
 * 提取自 v1/auth.js 和 sales/auth.js 的重复逻辑
 * @module lib/hono/_shared/auth-helpers
 */

import { generateJWT, MSG, hashPassword } from './utils.js';
import { parseJsonArray } from '../../../api/utils/json.js';
import {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
  formatRetryAfter,
} from '../middleware/rateLimit.js';
import { setCookie } from 'hono/cookie';

// ============================
// Cookie 常量
// ============================
export const SALES_TOKEN_COOKIE = 'sales_token';
export const SALES_COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 天

/**
 * 生成锁定错误消息
 * @param {number} retryAfter - 秒数
 * @returns {string}
 */
export function getLockedMessage(retryAfter) {
  return MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(retryAfter));
}

/**
 * 获取请求的 IP 地址
 * @param {Object} c - Hono context
 * @returns {string}
 */
function getClientIp(c) {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}

/**
 * 获取 KV 实例（兼容不同绑定名）
 * @param {Object} env
 * @returns {Object}
 */
function getKV(env) {
  return env.RATE_LIMIT_KV || env.KV;
}

/**
 * 检查登录限流，如果被锁定则返回 429 响应对象，否则返回 null
 * @param {Object} c - Hono context
 * @param {string} identifier - 用户标识（username / accessToken）
 * @returns {Promise<Response|null>}
 */
export async function checkAndRespondLockout(c, identifier) {
  const kv = getKV(c.env);
  const ip = getClientIp(c);

  const lockoutStatus = await checkLoginLockout(kv, ip, identifier);
  if (lockoutStatus.locked) {
    return c.json(
      {
        success: false,
        error: getLockedMessage(lockoutStatus.retryAfter),
        retryAfter: lockoutStatus.retryAfter,
      },
      429,
      { 'Retry-After': String(lockoutStatus.retryAfter) }
    );
  }
  return null;
}

/**
 * 记录登录失败并返回适当的错误响应
 * @param {Object} c - Hono context
 * @param {string} identifier - 用户标识
 * @param {string} errorMsg - 错误消息
 * @returns {Promise<Response>}
 */
export async function handleLoginFailure(c, identifier, errorMsg = MSG.AUTH.INVALID_CREDENTIALS) {
  const kv = getKV(c.env);
  const ip = getClientIp(c);

  const failureResult = await recordLoginFailure(kv, ip, identifier, c.executionCtx);

  if (failureResult.locked) {
    return c.json(
      {
        success: false,
        error: getLockedMessage(failureResult.retryAfter),
        retryAfter: failureResult.retryAfter,
      },
      429,
      { 'Retry-After': String(failureResult.retryAfter) }
    );
  }

  return c.json(
    { success: false, error: errorMsg, remaining: failureResult.remaining },
    401
  );
}

/**
 * 清除登录失败记录
 * @param {Object} c - Hono context
 * @param {string} identifier - 用户标识
 */
export async function clearFailures(c, identifier) {
  const kv = getKV(c.env);
  const ip = getClientIp(c);
  await clearLoginFailures(kv, ip, identifier, c.executionCtx);
}

/**
 * 设置销售端 JWT Cookie
 * @param {Object} c - Hono context
 * @param {string} token - JWT token
 */
export function setSalesTokenCookie(c, token) {
  const isSecure = c.req.url.startsWith('https://');
  setCookie(c, SALES_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    maxAge: SALES_COOKIE_MAX_AGE,
    path: '/api/sales',
  });
}

/**
 * 生成销售端 JWT 并设置 Cookie
 * @param {Object} c - Hono context
 * @param {Object} salesperson - 销售人员信息 { id, name }
 * @returns {Promise<string>} JWT token
 */
export async function generateSalesToken(c, salesperson) {
  const token = await generateJWT(
    { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
    c.env,
    SALES_COOKIE_MAX_AGE
  );
  setSalesTokenCookie(c, token);
  return token;
}

/**
 * 认证管理端用户 (Root Admin + DB Users)
 * 提取自 v1/auth.js 的重复认证逻辑
 * @param {Object} env - Cloudflare env
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object|null>} 用户对象或 null
 */
export async function authenticateAdminUser(env, username, password) {
  // 1. 检查 Root Admin
  if (username === env.BASIC_USER && password === env.BASIC_PASS) {
    return {
      id: username,
      name: 'Administrator',
      type: 'admin',
      role: 'admin',
      permissions: ['admin:full'],
    };
  }

  // 2. 查询数据库用户
  const dbUser = await env.DB.prepare(
    'SELECT id, password_hash, name, role, permissions FROM users WHERE username = ?'
  )
    .bind(username)
    .first();

  if (!dbUser) return null;

  // 3. 验证密码（hashPassword + 比较）
  const inputHash = await hashPassword(password, env.JWT_SECRET);
  if (inputHash !== dbUser.password_hash) return null;

  return {
    id: dbUser.id,
    name: dbUser.name,
    type: 'user',
    role: dbUser.role,
    permissions: parseJsonArray(dbUser.permissions, []),
  };
}

/**
 * 获取客户端 User-Agent
 * @param {Object} c - Hono context
 * @returns {string}
 */
export function getUserAgent(c) {
  return c.req.header('User-Agent') || 'Unknown';
}

/**
 * 获取客户端 IP（公开版本，供路由使用）
 * @param {Object} c - Hono context
 * @returns {string}
 */
export { getClientIp };
