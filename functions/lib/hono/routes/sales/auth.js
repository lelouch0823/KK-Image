import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie } from 'hono/cookie';
import { SalesLoginSchema, WechatLoginSchema } from '../../schemas/sales.js';
import { generateJWT, MSG, hashPassword } from '../../_shared/utils.js';
import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';
import {
    checkLoginLockout,
    recordLoginFailure,
    clearLoginFailures,
    loginRateLimitMiddleware,
    formatRetryAfter,
} from '../../middleware/rateLimit.js';
import { NotFoundError, ForbiddenError } from '../../errors.js';

const app = new Hono();

// Cookie 配置常量
const SALES_TOKEN_COOKIE = 'sales_token';
const COOKIE_MAX_AGE = 7 * 24 * 3600; // 7天

/**
 * 生成锁定错误消息
 */
function getLockedMessage(retryAfter) {
    return MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(retryAfter));
}

/**
 * POST /login - 用户名密码登录
 */
app.post('/login', loginRateLimitMiddleware, zValidator('json', SalesLoginSchema), async (c) => {
    const { username, password } = c.req.valid('json');
    const { env } = c;
    const kv = env.RATE_LIMIT_KV || env.KV;
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    // 检查是否被锁定
    const lockoutStatus = await checkLoginLockout(kv, ip, username);
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

    const salesperson = await env.DB.prepare(`
      SELECT id, name, store, phone, access_token, password_hash, is_active
      FROM salespersons
      WHERE (phone = ? OR name = ?) AND is_active = 1
    `).bind(username.trim(), username.trim()).first();

    if (!salesperson) {
        // 记录失败（用户不存在也计入，防止用户名枚举）
        await recordLoginFailure(kv, ip, username, c.executionCtx);
        return c.json({ success: false, error: MSG.AUTH.INVALID_CREDENTIALS }, 401);
    }

    const passwordHash = await hashPassword(password, env.JWT_SECRET);

    if (salesperson.password_hash !== passwordHash) {
        // 记录登录失败
        const failureResult = await recordLoginFailure(kv, ip, username, c.executionCtx);

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

        return c.json({
            success: false,
            error: MSG.AUTH.INVALID_CREDENTIALS,
            remaining: failureResult.remaining,
        }, 401);
    }

    // 登录成功，清除失败记录
    await clearLoginFailures(kv, ip, username, c.executionCtx);

    const token = await generateJWT(
        { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
        env,
        COOKIE_MAX_AGE
    );

    // 记录登录信息
    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    await repo.recordLogin(salesperson.id, ip, userAgent);

    // 设置 HttpOnly Cookie
    setCookie(c, SALES_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/api/sales',
    });

    return c.json({
        success: true,
        data: {
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            token: token,
            accessToken: salesperson.access_token,
            expiresIn: COOKIE_MAX_AGE,
        }
    });
});

/**
 * POST /wechat-login - 微信登录
 */
app.post('/wechat-login', loginRateLimitMiddleware, zValidator('json', WechatLoginSchema), async (c) => {
    const { code } = c.req.valid('json');
    const { env } = c;

    if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
        return c.json({ success: false, error: '微信登录未配置' }, 503);
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APPID}&secret=${env.WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode) {
        throw new Error(wxData.errmsg);
    }

    const { openid } = wxData;
    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const salesperson = await repo.findByWechatOpenid(openid);

    if (!salesperson) {
        return c.json({ success: true, data: { needBind: true, openid } });
    }

    if (!salesperson.is_active) {
        throw new ForbiddenError(MSG.SALESPERSON.DISABLED);
    }

    const token = await generateJWT(
        { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
        env,
        COOKIE_MAX_AGE
    );

    // 记录登录信息
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'Unknown';
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    await repo.recordLogin(salesperson.id, ip, userAgent);

    // 设置 HttpOnly Cookie
    setCookie(c, SALES_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/api/sales',
    });

    return c.json({
        success: true,
        data: {
            token,
            user: { id: salesperson.id, name: salesperson.name, store: salesperson.store },
            expiresIn: COOKIE_MAX_AGE
        }
    });
});

/**
 * POST /:token/auth - 路径 Token 登录验证 (用于分享链接跳转)
 */
app.post('/:token/auth', loginRateLimitMiddleware, async (c) => {
    const accessToken = c.req.param('token');
    const { password } = await c.req.json();
    const { env } = c;
    const kv = env.RATE_LIMIT_KV || env.KV;
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    // 检查是否被锁定（使用 accessToken 作为用户标识）
    const lockoutStatus = await checkLoginLockout(kv, ip, accessToken);
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

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const salesperson = await repo.findByToken(accessToken);

    if (!salesperson) throw new NotFoundError(MSG.SALESPERSON.NOT_FOUND);
    if (!salesperson.is_active) throw new ForbiddenError(MSG.SALESPERSON.DISABLED);

    const inputHash = await hashPassword(password, env.JWT_SECRET);

    if (inputHash !== salesperson.password_hash) {
        // 记录登录失败
        const failureResult = await recordLoginFailure(kv, ip, accessToken, c.executionCtx);

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

        return c.json({
            success: false,
            error: MSG.SALESPERSON.INVALID_PASSWORD,
            remaining: failureResult.remaining,
        }, 401);
    }

    // 登录成功，清除失败记录
    await clearLoginFailures(kv, ip, accessToken, c.executionCtx);

    const token = await generateJWT(
        { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
        env,
        COOKIE_MAX_AGE
    );

    // 记录登录信息
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    await repo.recordLogin(salesperson.id, ip, userAgent);

    // 设置 HttpOnly Cookie
    setCookie(c, SALES_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/api/sales',
    });

    return c.json({
        success: true,
        data: {
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            token: token,
            expiresIn: COOKIE_MAX_AGE,
        }
    });
});

export default app;
