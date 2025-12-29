/**
 * Turnstile 验证 API
 * POST /api/turnstile/verify - 验证 Turnstile token
 */
import { success, error } from '../utils/response.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { token } = await request.json();

        if (!token) {
            return error('缺少验证令牌', 400);
        }

        // Get secret key from environment
        const secretKey = env.TURNSTILE_SECRET_KEY;
        if (!secretKey) {
            console.warn('TURNSTILE_SECRET_KEY not configured, skipping verification');
            // Graceful degradation: allow through if not configured
            return success(null, '验证已跳过');
        }

        // Verify with Cloudflare Turnstile API
        const formData = new FormData();
        formData.append('secret', secretKey);
        formData.append('response', token);
        formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const result = await verifyResponse.json();

        if (result.success) {
            return success(null, '验证通过');
        } else {
            console.error('Turnstile verification failed:', result['error-codes']);
            return error('验证失败，请重试', 403);
        }
    } catch (err) {
        console.error('Turnstile verification error:', err);
        return error('验证服务错误', 500);
    }
}

/**
 * GET /api/turnstile/verify - 获取 Turnstile 配置
 * 用于前端获取 Site Key，避免硬编码
 */
export async function onRequestGet(context) {
    const { env } = context;

    const siteKey = env.TURNSTILE_SITE_KEY || '';
    const enabled = !!siteKey && !!env.TURNSTILE_SECRET_KEY;

    return success({
        enabled,
        siteKey: enabled ? siteKey : null
    });
}
