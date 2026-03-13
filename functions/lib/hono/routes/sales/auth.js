import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SalesLoginSchema, WechatLoginSchema } from '../../schemas/sales.js';
import { MSG, hashPassword } from '../../_shared/utils.js';
import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';
import { loginRateLimitMiddleware } from '../../middleware/rateLimit.js';
import { NotFoundError, ForbiddenError } from '../../errors.js';
import { requireEntity } from '../../_shared/route-helpers.js';
import {
  checkAndRespondLockout,
  handleLoginFailure,
  clearFailures,
  generateSalesToken,
  SALES_COOKIE_MAX_AGE,
  getClientIp,
  getUserAgent,
} from '../../_shared/auth-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/login', domain: 'sales-auth', action: 'sales.auth.login', severity: 'high', targetType: 'salesperson' },
  { method: 'POST', path: '/wechat-login', domain: 'sales-auth', action: 'sales.auth.wechat_login', severity: 'high', targetType: 'salesperson' },
  { method: 'POST', path: '/:token/auth', domain: 'sales-auth', action: 'sales.auth.token_login', severity: 'high', targetType: 'salesperson' },
]);

/**
 * POST /login - 用户名密码登录
 */
app.post('/login', loginRateLimitMiddleware, zValidator('json', SalesLoginSchema), async (c) => {
    const { username, password } = c.req.valid('json');
    const { env } = c;

    // 检查是否被锁定
    const lockoutRes = await checkAndRespondLockout(c, username);
    if (lockoutRes) return lockoutRes;

    const salesperson = await env.DB.prepare(`
      SELECT id, name, store, phone, access_token, password_hash, is_active
      FROM salespersons
      WHERE (phone = ? OR name = ?) AND is_active = 1
    `).bind(username.trim(), username.trim()).first();

    if (!salesperson) {
        // 记录失败（用户不存在也计入，防止用户名枚举）
        return handleLoginFailure(c, username);
    }

    const passwordHash = await hashPassword(password, env.JWT_SECRET);

    if (salesperson.password_hash !== passwordHash) {
        return handleLoginFailure(c, username);
    }

    // 登录成功，清除失败记录
    await clearFailures(c, username);

    // SOTA: 使用提取的辅助函数生成 JWT + Cookie
    const token = await generateSalesToken(c, salesperson);

    // 记录登录信息
    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const ip = getClientIp(c);
    const userAgent = getUserAgent(c);
    await repo.recordLogin(salesperson.id, ip, userAgent);
    scheduleAuditEvent(c, {
      domain: 'sales-auth',
      action: 'sales.auth.login',
      result: 'success',
      severity: 'high',
      targetType: 'salesperson',
      targetId: salesperson.id,
      target_label: salesperson.name,
      summary: `${salesperson.name} logged in`,
      metadata: { loginType: 'password' },
    });

    return c.json({
        success: true,
        data: {
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            token: token,
            accessToken: salesperson.access_token,
            expiresIn: SALES_COOKIE_MAX_AGE,
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

    // SOTA: 使用提取的辅助函数生成 JWT + Cookie
    const token = await generateSalesToken(c, salesperson);

    // 记录登录信息
    const ip = getClientIp(c);
    const userAgent = getUserAgent(c);
    await repo.recordLogin(salesperson.id, ip, userAgent);
    scheduleAuditEvent(c, {
      domain: 'sales-auth',
      action: 'sales.auth.wechat_login',
      result: 'success',
      severity: 'high',
      targetType: 'salesperson',
      targetId: salesperson.id,
      target_label: salesperson.name,
      summary: `${salesperson.name} logged in with WeChat`,
    });

    return c.json({
        success: true,
        data: {
            token,
            user: { id: salesperson.id, name: salesperson.name, store: salesperson.store },
            expiresIn: SALES_COOKIE_MAX_AGE
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

    // 检查是否被锁定（使用 accessToken 作为用户标识）
    const lockoutRes = await checkAndRespondLockout(c, accessToken);
    if (lockoutRes) return lockoutRes;

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const salesperson = await requireEntity(
        repo.findByToken(accessToken),
        () => new NotFoundError(MSG.SALESPERSON.NOT_FOUND)
    );
    if (!salesperson.is_active) throw new ForbiddenError(MSG.SALESPERSON.DISABLED);

    const inputHash = await hashPassword(password, env.JWT_SECRET);

    if (inputHash !== salesperson.password_hash) {
        return handleLoginFailure(c, accessToken, MSG.SALESPERSON.INVALID_PASSWORD);
    }

    // 登录成功，清除失败记录
    await clearFailures(c, accessToken);

    // SOTA: 使用提取的辅助函数生成 JWT + Cookie
    const token = await generateSalesToken(c, salesperson);

    // 记录登录信息
    const ip = getClientIp(c);
    const userAgent = getUserAgent(c);
    await repo.recordLogin(salesperson.id, ip, userAgent);
    scheduleAuditEvent(c, {
      domain: 'sales-auth',
      action: 'sales.auth.token_login',
      result: 'success',
      severity: 'high',
      targetType: 'salesperson',
      targetId: salesperson.id,
      target_label: salesperson.name,
      summary: `${salesperson.name} authenticated via access token`,
    });

    return c.json({
        success: true,
        data: {
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            token: token,
            expiresIn: SALES_COOKIE_MAX_AGE,
        }
    });
});

export default app;
