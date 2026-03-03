import { MSG } from '../_shared/utils.js';
import { authenticateSalesperson } from '../../../api/utils/salesperson-auth.js';

const resolveAuthStatus = (message) => {
    if (message === MSG.SALESPERSON.NOT_FOUND) return 404;
    if (message === MSG.SALESPERSON.DISABLED || message === MSG.AUTH.FORBIDDEN) return 403;
    if (
        message === MSG.AUTH.REQUIRED ||
        message === MSG.AUTH.EXPIRED ||
        message === MSG.AUTH.JWT_REQUIRED ||
        message === MSG.AUTH.JWT_SECRET_MISSING ||
        message === MSG.AUTH.JWT_INVALID ||
        message === MSG.AUTH.JWT_EXPIRED ||
        (typeof message === 'string' && message.startsWith(`${MSG.AUTH.JWT_FAILED}:`))
    ) {
        return 401;
    }
    return null;
};

/**
 * 销售人员授权中间件
 * 
 * 职责：
 * 1. 验证 JWT (Bearer 或 Cookie)
 * 2. 验证路径中的 :token 是否与该销售人员匹配
 * 3. 将销售人员信息存入 context
 */
export const salesAuthMiddleware = async (c, next) => {
    const accessToken = c.req.param('token');
    if (!accessToken) {
        return c.json({ success: false, error: 'Access token required in path' }, 400);
    }

    let salesperson = null;
    try {
        salesperson = await authenticateSalesperson(c.req.raw, c.env, accessToken);
    } catch (err) {
        const errorMessage = typeof err?.message === 'string' && err.message ? err.message : MSG.AUTH.EXPIRED;
        const status = resolveAuthStatus(errorMessage);
        if (status) {
            return c.json({ success: false, error: errorMessage }, status);
        }
        console.error('salesAuthMiddleware unexpected error');
        return c.json({ success: false, error: MSG.COMMON.OP_FAILED }, 500);
    }

    c.set('salesperson', salesperson);
    await next();
};
