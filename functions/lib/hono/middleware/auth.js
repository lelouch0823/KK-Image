import { verifyJWT, verifyApiKey, extractAdminAuthToken, MSG } from '../../../_shared/utils.js';
import { evaluateUserPermission } from '../../authz/index.js';
import { isLegacyJwtContext } from '../_shared/auth-context.js';
import {
  getAuditScheduler,
  getRequestAuditContext,
  inferAuditDomainFromPath,
  inferAuditTargetFromPath,
  recordAuditEvent,
  shouldAuditRequest,
} from '../_shared/audit-helpers.js';

/**
 * 公开路由列表（无需认证）
 */
export const publicRoutes = [
  '/api/v1/auth/login',
  '/api/v1/auth/check',
  '/api/v1/auth/logout',
  '/api/v1/auth/token',
  '/api/sales/login',
  '/api/sales/wechat-login',
  '/api/manage/oauth/token',
  '/api/manage/oauth/revoke',
];

// Routes that are intentionally public by prefix, with path-boundary matching.
const publicRoutePrefixes = ['/api/v1/health', '/api/v1/api-docs', '/api/gallery', '/api/space'];

function isPublicRoute(path) {
  if (publicRoutes.includes(path)) return true;
  return publicRoutePrefixes.some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * JWT 认证中间件
 */
export async function authMiddleware(c, next) {
  const path = c.req.path;
  const method = c.req.method;

  // 跳过公开路由（仅匹配 /api/sales/:token/auth，其中 token 为字母数字格式）
  // 先做前缀匹配再走正则，避免对明显不匹配的路径执行正则
  if (
    isPublicRoute(path) ||
    (path.startsWith('/api/sales/') &&
      path.endsWith('/auth') &&
      /^\/api\/sales\/[A-Za-z0-9]+\/auth$/.test(path))
  ) {
    return next();
  }

  // 审计上下文延迟初始化：仅在认证失败时才计算，公开路由和成功认证均跳过
  const shouldAudit = shouldAuditRequest(method, path);
  const recordUnauthorizedAttempt = (reason) => {
    if (!shouldAudit || !c.env?.DB) return;
    const auditContext = getRequestAuditContext(c);
    const scheduler = getAuditScheduler(c);
    const domain = inferAuditDomainFromPath(path);
    const targetId = inferAuditTargetFromPath(path);
    scheduler(
      recordAuditEvent(c.env.DB, {
        ...auditContext,
        userId: auditContext.actor_id,
        domain,
        action: `${domain}.${method.toLowerCase()}.unauthorized`,
        result: 'denied',
        severity: 'high',
        targetType: domain,
        targetId,
        summary: `Unauthorized ${method} attempt on ${path}`,
        metadata: { path, method, reason },
        ip: auditContext.ip_address,
        user_agent: auditContext.user_agent,
      })
    );
  };

  // 获取 Token（优先从 Authorization Header，其次从 Cookie）
  let token = extractAdminAuthToken(c.req.raw, { preferBearer: true });

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
        recordUnauthorizedAttempt('invalid_api_key');
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
    recordUnauthorizedAttempt('missing_token');
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
    if (isLegacyJwtContext(payload)) {
      recordUnauthorizedAttempt('legacy_jwt_context');
      return c.json(
        {
          success: false,
          error: MSG.AUTH.EXPIRED,
        },
        401
      );
    }
    c.set('user', payload);
    return next();
  } catch (err) {
    console.error('JWT Verification Failed:', err);
    recordUnauthorizedAttempt('invalid_jwt');
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
    const method = c.req.method;
    const shouldAudit = shouldAuditRequest(method, c.req.path);
    const auditContext = getRequestAuditContext(c);
    const scheduler = getAuditScheduler(c);
    const domain = inferAuditDomainFromPath(c.req.path);
    const targetId = inferAuditTargetFromPath(c.req.path);

    if (!user) {
      if (shouldAudit && c.env?.DB) {
        scheduler(
          recordAuditEvent(c.env.DB, {
            ...auditContext,
            userId: auditContext.actor_id,
            domain,
            action: `${domain}.${method.toLowerCase()}.unauthorized`,
            result: 'denied',
            severity: 'high',
            targetType: domain,
            targetId,
            summary: `Unauthorized ${method} attempt on ${c.req.path}`,
            metadata: { permission, path: c.req.path, method },
            ip: auditContext.ip_address,
            user_agent: auditContext.user_agent,
          })
        );
      }
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const allowed = await checkPermission(c, user, permission);

    if (allowed) {
      return next();
    }

    if (shouldAudit && c.env?.DB) {
      scheduler(
        recordAuditEvent(c.env.DB, {
          ...auditContext,
          userId: auditContext.actor_id,
          domain,
          action: `${domain}.${method.toLowerCase()}.denied`,
          result: 'denied',
          severity: 'high',
          targetType: domain,
          targetId,
          summary: `${auditContext.actor_name} was denied ${method} on ${c.req.path}`,
          metadata: { permission, path: c.req.path, method },
          ip: auditContext.ip_address,
          user_agent: auditContext.user_agent,
        })
      );
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
