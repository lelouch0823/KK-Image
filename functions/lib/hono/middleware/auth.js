import { verifyJWT, verifyApiKey, ADMIN_AUTH_COOKIE, MSG } from '../_shared/utils.js';
import { evaluateUserPermission } from '../../authz/index.js';

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
  '/api/space',
  '/api/sales/login',
  '/api/sales/wechat-login',
];

/**
 * JWT 认证中间件
 */
export async function authMiddleware(c, next) {
  const path = c.req.path;

  // 跳过公开路由
  if (publicRoutes.some((route) => path.startsWith(route)) || /^\/api\/sales\/[^/]+\/auth$/.test(path)) {
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
        cookieHeader.split(';').map((c) => {
          const [name, ...value] = c.trim().split('=');
          return [name, value.join('=')];
        })
      );
      token = cookies[ADMIN_AUTH_COOKIE];
    }
  }

  // 检查 API Key
  if (!token) {
    const apiKey = c.req.header('X-API-Key');
    if (apiKey) {
      try {
        // 验证 API Key (支持 D1 和 DEFAULT_API_KEY)
        const user = await verifyApiKey(apiKey, c.env);
        c.set('user', user);
        return next();
      } catch (err) {
        console.error('API Key Verification Failed:', err);
        return c.json(
          {
            success: false,
            error: `${MSG.AUTH.INVALID_TOKEN}: ${err.message}`,
          },
          401
        );
      }
    }
  }

  if (!token) {
    return c.json(
      {
        success: false,
        error: MSG.AUTH.REQUIRED,
      },
      401
    );
  }

  // 验证 JWT
  try {
    const payload = await verifyJWT(token, c.env);
    c.set('user', payload);
    return next();
  } catch (err) {
    console.error('JWT Verification Failed:', err);
    return c.json(
      {
        success: false,
        error: `${MSG.AUTH.EXPIRED} (${err.message})`,
      },
      401
    );
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

    const allowed = await checkPermission(c, user, permission);

    if (allowed) {
      return next();
    }

    return c.json(
      {
        success: false,
        error: `${MSG.AUTH.FORBIDDEN}: ${permission}`,
      },
      403
    );
  };
}

export async function checkPermission(c, user, permission) {
  return evaluateUserPermission({
    user,
    permission,
    path: c.req.path,
    method: c.req.method,
  });
}
