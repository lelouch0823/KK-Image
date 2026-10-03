/**
 * Turnstile 验证 API
 * POST /api/turnstile/verify - 验证 Turnstile token
 */
import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';

const rateLimitBuckets = new Map();
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RATE_LIMIT_MAX = 20;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

export function __resetTurnstileRateLimitForTest() {
  rateLimitBuckets.clear();
}

function isProduction(env = {}) {
  return String(env.ENVIRONMENT || env.NODE_ENV || '').toLowerCase() === 'production';
}

function isTurnstileOptional(env = {}) {
  return !isProduction(env) && !env.TURNSTILE_SITE_KEY;
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * 限流（S-L4）：配置了 KV 时用 KV 计数（跨 isolate 共享预算），
 * 未配置 KV 时回退进程内 Map（单 isolate 有效）。
 * KV 计数为近似限流（并发计数可能少记），对验证端点足够。
 */
async function checkRateLimit(request, env = {}) {
  const maxAttempts = Math.max(1, Number(env.TURNSTILE_RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT_MAX);
  const windowMs = Math.max(
    1000,
    Number(env.TURNSTILE_RATE_LIMIT_WINDOW_MS) || DEFAULT_RATE_LIMIT_WINDOW_MS
  );
  const now = Date.now();
  const ip = getClientIp(request);

  if (env?.KV) {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const kvKey = `turnstile:rl:${ip}:${windowStart}`;
    try {
      const current = Number((await env.KV.get(kvKey)) || 0);
      if (current >= maxAttempts) return false;
      await env.KV.put(kvKey, String(current + 1), {
        expirationTtl: Math.ceil(windowMs / 1000) + 1,
      });
      return true;
    } catch (err) {
      console.error('Turnstile KV rate limit failed, falling back to memory:', err);
    }
  }

  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= maxAttempts;
}

function createTimeoutSignal(timeoutMs) {
  const safeTimeout = Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(safeTimeout);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), safeTimeout);
  return controller.signal;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await checkRateLimit(request, env))) {
    return error('Too many verification attempts', 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body', 400);
  }

  try {
    const { token } = body || {};

    if (!token) return error(MSG.AUTH.MISSING_TOKEN, 400);

    // Get secret key from environment
    const secretKey = env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      if (isTurnstileOptional(env)) {
        console.warn('TURNSTILE_SECRET_KEY not configured, skipping verification');
        return success(null, MSG.AUTH.VERIFY_SKIPPED);
      }
      console.error('TURNSTILE_SECRET_KEY not configured; failing verification closed');
      return error(MSG.AUTH.VERIFY_ERROR, 503);
    }

    // Verify with Cloudflare Turnstile API
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

    const verifyResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
        signal: createTimeoutSignal(env.TURNSTILE_TIMEOUT_MS),
      }
    );

    const result = await verifyResponse.json();

    if (result.success) {
      return success(null, MSG.AUTH.VERIFY_SUCCESS);
    } else {
      console.error('Turnstile verification failed:', result['error-codes']);
      return error(MSG.AUTH.VERIFY_FAILED, 403);
    }
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return error(MSG.AUTH.VERIFY_ERROR, 503);
  }
}

/**
 * GET /api/turnstile/verify - 获取 Turnstile 配置
 * 用于前端获取 Site Key，避免硬编码
 * 已登录管理员自动跳过 Turnstile
 */
export async function onRequestGet(context) {
  const { env, request } = context;

  // 检查是否为已认证管理员
  let isAdmin = false;
  try {
    const { verifyJWT, extractRequestToken } = await import('../utils/auth.js');
    const token = extractRequestToken(request, { cookieName: 'ADMIN_AUTH', includeBearer: false });
    if (token) {
      await verifyJWT(token, env);
      isAdmin = true;
    }
  } catch {
    // 未登录或 token 无效
  }

  const siteKey = env.TURNSTILE_SITE_KEY || '';
  const configEnabled = !!siteKey && !!env.TURNSTILE_SECRET_KEY;
  // 管理员跳过 Turnstile
  const enabled = configEnabled && !isAdmin;

  return success({
    enabled,
    siteKey: enabled ? siteKey : null,
    isAdmin,
  });
}
