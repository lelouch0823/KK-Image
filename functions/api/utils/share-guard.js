/**
 * 公开分享密码防护（gallery / space 共享）
 *
 * 两层防护：
 * 1. 按 (IP, 分享token) 的失败锁定 —— checkLoginLockout / recordLoginFailure
 * 2. 按 IP 的滑动窗口预算 —— 防 IPv6 轮换为每个来源换取全新锁定桶的绕过手法
 *
 * 该模块服务于 Pages Functions 文件路由（/api/gallery/:token、/api/space/:token），
 * 位于 Hono 中间件链之外，因此在此显式实现限流而非依赖 app.js 的全局限流。
 */
import {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
} from '../../lib/hono/middleware/rateLimit.js';
import { error } from './response.js';
import { MSG } from './messages.js';

// 单 IP 每分钟可尝试的分享密码次数上限（跨所有分享令牌累计）
const SHARE_IP_WINDOW_MS = 60_000;
const SHARE_IP_MAX_ATTEMPTS = 20;

function getRateLimitKv(env = {}) {
  return env.RATE_LIMIT_KV || env.KV || null;
}

export function getPublicClientIp(request) {
  return request?.headers?.get('CF-Connecting-IP') || 'unknown';
}

async function consumePerIpShareBudget(kv, ip) {
  if (!kv || !ip || ip === 'unknown') {
    return { limited: false };
  }
  const windowKey = Math.floor(Date.now() / SHARE_IP_WINDOW_MS);
  const key = `share_pw:${ip}:${windowKey}`;
  let count = 0;
  try {
    count = parseInt((await kv.get(key)) || '0', 10);
  } catch {
    // KV 故障时不放大为拒绝服务（按 IP 预算是尽力而为的第二层）
    return { limited: false };
  }
  if (count >= SHARE_IP_MAX_ATTEMPTS) {
    return { limited: true };
  }
  try {
    // get→put 非原子：并发尝试可能少量超预算，作为兜底层可接受
    await kv.put(key, String(count + 1), { expirationTtl: 120 });
  } catch {
    // 忽略写入失败
  }
  return { limited: false };
}

/**
 * 校验一次分享密码尝试是否被允许（按 IP 预算 + 按 (IP, token) 锁定）
 * @returns {Promise<Response|null>} 被限流时返回 429/503 响应，否则返回 null
 */
export async function authorizePublicPasswordAttempt(env, request, identifier) {
  const kv = getRateLimitKv(env);
  const ip = getPublicClientIp(request);

  const budget = await consumePerIpShareBudget(kv, ip);
  if (budget.limited) {
    return error('Too many password attempts from this IP', 429);
  }

  const status = await checkLoginLockout(kv, ip, identifier);
  if (status.unavailable) {
    return error('Public share protection unavailable', 503);
  }
  if (status.locked) {
    return error(MSG.AUTH.TOO_MANY_ATTEMPTS || 'Too many attempts', 429);
  }
  return null;
}

/**
 * 记录一次分享密码验证失败（进入按 (IP, token) 锁定状态机）
 * @returns {Promise<Response|null>} KV 不可用时返回 503（fail-closed），否则 null
 */
export async function recordPublicPasswordFailure(env, request, identifier) {
  const kv = getRateLimitKv(env);
  const status = await recordLoginFailure(kv, getPublicClientIp(request), identifier);
  if (status.unavailable) {
    return error('Public share protection unavailable', 503);
  }
  return null;
}

/**
 * 分享密码验证成功后清除失败记录
 */
export async function clearPublicPasswordFailures(env, request, identifier) {
  const kv = getRateLimitKv(env);
  if (!kv) return;
  await clearLoginFailures(kv, getPublicClientIp(request), identifier);
}
