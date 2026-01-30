import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie } from 'hono/cookie';
import { SalesLoginSchema, WechatLoginSchema } from '../../schemas/sales.js';
import { generateJWT, MSG } from '../../_shared/utils.js';
import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';

const app = new Hono();

// Cookie 配置常量
const SALES_TOKEN_COOKIE = 'sales_token';
const COOKIE_MAX_AGE = 7 * 24 * 3600; // 7天

/**
 * POST /login - 用户名密码登录
 */
app.post('/login', zValidator('json', SalesLoginSchema), async (c) => {
    const { username, password } = c.req.valid('json');
    const { env } = c;

    try {
        const salesperson = await env.DB.prepare(`
      SELECT id, name, store, phone, access_token, password_hash, is_active
      FROM salespersons
      WHERE (phone = ? OR name = ?) AND is_active = 1
    `).bind(username.trim(), username.trim()).first();

        if (!salesperson) {
            return c.json({ success: false, error: '用户不存在' }, 400);
        }

        const { hashPassword } = await import('../../_shared/utils.js');
        const passwordHash = await hashPassword(password, env.JWT_SECRET);

        if (salesperson.password_hash !== passwordHash) {
            return c.json({ success: false, error: '密码错误' }, 400);
        }

        const token = await generateJWT(
            { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
            env,
            COOKIE_MAX_AGE
        );

        // 记录登录信息
        const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
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
                id: salesperson.id,
                name: salesperson.name,
                store: salesperson.store,
                token: token,
                accessToken: salesperson.access_token,
                expiresIn: COOKIE_MAX_AGE,
            }
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST /wechat-login - 微信登录
 */
app.post('/wechat-login', zValidator('json', WechatLoginSchema), async (c) => {
    const { code } = c.req.valid('json');
    const { env } = c;

    if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
        return c.json({ success: false, error: '微信登录未配置' }, 503);
    }

    try {
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
            return c.json({ success: false, error: MSG.SALESPERSON.DISABLED }, 403);
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
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST /:token/auth - 路径 Token 登录验证 (用于分享链接跳转)
 */
app.post('/:token/auth', async (c) => {
    const accessToken = c.req.param('token');
    const { password } = await c.req.json();
    const { env } = c;

    try {
        const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
        const salesperson = await repo.findByToken(accessToken);

        if (!salesperson) return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
        if (!salesperson.is_active) return c.json({ success: false, error: MSG.SALESPERSON.DISABLED }, 403);

        const { hashPassword } = await import('../../_shared/utils.js');
        const inputHash = await hashPassword(password, env.JWT_SECRET);

        if (inputHash !== salesperson.password_hash) {
            return c.json({ success: false, error: MSG.SALESPERSON.INVALID_PASSWORD }, 401);
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
                id: salesperson.id,
                name: salesperson.name,
                store: salesperson.store,
                token: token,
                expiresIn: COOKIE_MAX_AGE,
            }
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default app;
