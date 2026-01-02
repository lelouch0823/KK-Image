/**
 * Turnstile 验证 API
 * POST /api/turnstile/verify - 验证 Turnstile token
 */
import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token } = await request.json();

    if (!token) {
      return error(MSG.AUTH.MISSING_TOKEN, 400);
    }

    // Get secret key from environment
    const secretKey = env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      console.warn('TURNSTILE_SECRET_KEY not configured, skipping verification');
      // Graceful degradation: allow through if not configured
      return success(null, MSG.AUTH.VERIFY_SKIPPED);
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
    return error(MSG.AUTH.VERIFY_ERROR, 500);
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
    const { verifyJWT } = await import('../utils/auth.js');
    const { parse: parseCookie } = await import('cookie');
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookieHeader);
    const token = cookies.auth_token;
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
