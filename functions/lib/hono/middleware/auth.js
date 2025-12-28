import { verifyJWT } from '../../../api/utils/auth.js';
import { MSG } from '../../../api/utils/messages.js';

/**
 * 公开路由列表（无需认证）
 */
export const publicRoutes = [
    '/api/v1/auth/login',
    '/api/v1/auth/check',
    '/api/v1/auth/logout',
    '/api/v1/auth/token',
    '/api/v1/health',
    '/api/gallery',
    '/api/space'
];

/**
 * JWT 认证中间件
 */
export async function authMiddleware(c, next) {
    const path = c.req.path;

    // 跳过公开路由
    if (publicRoutes.some(route => path.startsWith(route))) {
        return next();
    }

    // 获取 Token（优先从 Authorization Header，其次从 Cookie）
    let token = null;

    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    if (!token) {
        const cookieHeader = c.req.header('Cookie');
        if (cookieHeader) {
            const cookies = Object.fromEntries(
                cookieHeader.split(';').map(c => {
                    const [name, ...value] = c.trim().split('=');
                    return [name, value.join('=')];
                })
            );
            token = cookies['TELEG_AUTH'];
        }
    }

    // 检查 API Key
    if (!token) {
        const apiKey = c.req.header('X-API-Key');
        if (apiKey) {
            // 验证 API Key（简化版，实际应查询 KV）
            if (apiKey === c.env.DEFAULT_API_KEY) {
                c.set('user', { id: 'api', name: 'API User', type: 'api_key' });
                return next();
            }
        }
    }

    if (!token) {
        return c.json({
            success: false,
            error: MSG.AUTH.REQUIRED
        }, 401);
    }

    // 验证 JWT
    try {
        const payload = await verifyJWT(token, c.env);
        c.set('user', payload);
        return next();
    } catch (err) {
        console.error('JWT Verification Failed:', err);
        return c.json({
            success: false,
            error: `${MSG.AUTH.EXPIRED} (${err.message})`
        }, 401);
    }
}

/**
 * 权限检查中间件工厂
 * @param {string} permission - 所需权限
 */
export function requirePermission(permission) {
    return async (c, next) => {
        const user = c.get('user');

        if (!user) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }

        // 管理员拥有所有权限
        if (user.type === 'admin' || user.permissions?.includes('admin:full')) {
            return next();
        }

        // 检查特定权限
        if (user.permissions?.includes(permission)) {
            return next();
        }

        return c.json({
            success: false,
            error: `${MSG.AUTH.FORBIDDEN}: ${permission}`
        }, 403);
    };
}
