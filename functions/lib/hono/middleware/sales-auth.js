import { verifyJWT, MSG } from '../_shared/utils.js';
import { SalespersonRepository } from '../../../repositories/SalespersonRepository.js';

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

    let jwt = null;
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        jwt = authHeader.substring(7);
    }

    if (!jwt) {
        // 尝试从 cookie 获取，小程序也有可能使用 cookie
        const cookieHeader = c.req.header('Cookie');
        if (cookieHeader) {
            const cookies = Object.fromEntries(
                cookieHeader.split(';').map((c) => {
                    const [name, ...value] = c.trim().split('=');
                    return [name, value.join('=')];
                })
            );
            jwt = cookies['sales_token'];
        }
    }

    if (!jwt) {
        return c.json({ success: false, error: MSG.AUTH.REQUIRED }, 401);
    }

    try {
        const payload = await verifyJWT(jwt, c.env);
        if (payload.type !== 'salesperson') {
            return c.json({ success: false, error: MSG.AUTH.FORBIDDEN }, 403);
        }

        const repo = new SalespersonRepository(c.env.DB, c.env.JWT_SECRET);
        const salesperson = await repo.findById(payload.id);

        if (!salesperson || salesperson.access_token !== accessToken) {
            return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
        }

        if (!salesperson.is_active) {
            return c.json({ success: false, error: MSG.SALESPERSON.DISABLED }, 403);
        }

        c.set('salesperson', salesperson);
        return next();
    } catch (err) {
        console.error('Sales Auth Failed:', err);
        return c.json({ success: false, error: MSG.AUTH.EXPIRED }, 401);
    }
};
