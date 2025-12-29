import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { LoginSchema, TokenSchema, CreateApiKeySchema } from '../../schemas/user.js';
import { generateJWT, ADMIN_AUTH_COOKIE, verifyTurnstile } from '../../../../api/utils/auth.js';
import { MSG } from '../../../../api/utils/messages.js';

const app = new Hono();

/**
 * POST /api/v1/auth/login - 用户登录
 */
app.post('/login', zValidator('json', LoginSchema), async (c) => {
    const { username, password, turnstileToken } = c.req.valid('json');
    const { env } = c;

    // Turnstile 验证（如果配置）
    if (env.TURNSTILE_SECRET_KEY && turnstileToken) {
        const isValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
        if (!isValid) {
            return c.json({ success: false, error: MSG.AUTH.VERIFY_FAILED }, 400);
        }
    }

    // 验证凭据
    if (!env.BASIC_USER || !env.BASIC_PASS) {
        return c.json({ success: false, error: MSG.AUTH.UNCONFIGURED }, 503);
    }

    if (username !== env.BASIC_USER || password !== env.BASIC_PASS) {
        return c.json({ success: false, error: MSG.AUTH.INVALID_CREDENTIALS }, 401);
    }

    // 生成 JWT
    const user = { id: username, name: 'Administrator', type: 'admin', permissions: ['admin:full'] };
    const expiresIn = 7 * 24 * 60 * 60; // 7 天
    const token = await generateJWT(user, env, expiresIn);

    // 设置 Cookie（本地开发时不使用 Secure）
    const isSecure = c.req.url.startsWith('https://');
    const cookie = `${ADMIN_AUTH_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${expiresIn}; SameSite=Lax${isSecure ? '; Secure' : ''}`;

    return c.json({
        success: true,
        data: { user, expiresIn }
    }, 200, {
        'Set-Cookie': cookie
    });
});

/**
 * POST /api/v1/auth/token - 生成 API Token
 */
app.post('/token', zValidator('json', TokenSchema), async (c) => {
    const { username, password, expiresIn } = c.req.valid('json');
    const { env } = c;

    // 验证凭据
    if (username !== env.BASIC_USER || password !== env.BASIC_PASS) {
        return c.json({ success: false, error: MSG.AUTH.INVALID_CREDENTIALS }, 401);
    }

    const user = {
        id: username,
        name: 'Administrator',
        type: 'admin',
        permissions: ['admin:full']
    };

    const token = await generateJWT(user, env, expiresIn);

    return c.json({
        success: true,
        data: {
            token,
            tokenType: 'Bearer',
            expiresIn,
            user: { id: user.id, name: user.name }
        }
    });
});

/**
 * POST /api/v1/auth/logout - 登出
 */
app.post('/logout', async (c) => {
    const cookie = `${ADMIN_AUTH_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure`;

    return c.json({
        success: true,
        message: 'Logged out successfully'
    }, 200, {
        'Set-Cookie': cookie
    });
});

/**
 * GET /api/v1/auth/check - 检查认证状态
 */
app.get('/check', async (c) => {
    const { env } = c;

    const isAuthConfigured = !!(env.BASIC_USER && env.BASIC_PASS);

    return c.json({
        success: true,
        data: {
            authEnabled: isAuthConfigured,
            message: isAuthConfigured ? 'Authentication is enabled' : MSG.AUTH.UNCONFIGURED
        }
    });
});

/**
 * GET /api/v1/auth/me - 获取当前用户信息
 */
app.get('/me', async (c) => {
    const user = c.get('user');

    if (!user) {
        return c.json({ success: false, error: MSG.AUTH.REQUIRED }, 401);
    }

    return c.json({
        success: true,
        data: {
            id: user.id,
            name: user.name,
            type: user.type,
            permissions: user.permissions || []
        }
    });
});

export default app;
