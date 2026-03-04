import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import { evaluateUserPermission, getPolicyMetadata } from '../../../authz/index.js';

const app = new Hono();
const metadata = getPolicyMetadata();
const POLICY_ACTIONS = Array.isArray(metadata.actions) ? metadata.actions : [];
const ACTION_LABELS = metadata.actionLabels || {};
const ROLES = Object.fromEntries(
  Object.entries(metadata.roles || {}).map(([role, def]) => [
    role,
    {
      name: def?.label || role,
      permissions: Array.isArray(def?.permissions) ? def.permissions : [],
    },
  ])
);

const PERMISSIONS = Object.fromEntries(
  POLICY_ACTIONS.map((action) => [action, ACTION_LABELS[action] || action])
);

async function evaluateUserAction(c, user, action) {
  return evaluateUserPermission({
    user,
    permission: action,
    path: c.req.path,
    method: c.req.method,
  });
}

/**
 * GET /api/v1/permissions - 获取权限定义
 */
app.get('/', async (c) => {
  return c.json({
    success: true,
    data: {
      permissions: PERMISSIONS,
      roles: ROLES,
    },
  });
});

/**
 * GET /api/v1/permissions/user - 获取当前用户权限
 */
app.get('/user', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: MSG.AUTH.REQUIRED }, 401);
  }

  const checks = await Promise.all(
    POLICY_ACTIONS.map(async (action) => [action, await evaluateUserAction(c, user, action)])
  );
  const effectivePermissions = checks.filter(([, allowed]) => allowed).map(([action]) => action);
  const isAdmin = checks.find(([action]) => action === 'admin:full')?.[1] === true;

  return c.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, type: user.type },
      permissions: effectivePermissions,
      isAdmin,
    },
  });
});

/**
 * POST /api/v1/permissions/check - 批量检查权限
 */
app.post('/check', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: MSG.AUTH.REQUIRED }, 401);
  }

  const { permissions } = await c.req.json();

  if (!Array.isArray(permissions)) {
    return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
  }
  if (permissions.some((perm) => typeof perm !== 'string' || !perm)) {
    return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
  }

  const checks = await Promise.all(
    permissions.map(async (perm) => [perm, await evaluateUserAction(c, user, perm)])
  );
  const results = Object.fromEntries(checks);

  return c.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name },
      permissions: results,
    },
  });
});

export default app;
