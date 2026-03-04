import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import { getPolicyMetadata } from '../../../authz/index.js';

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
  POLICY_ACTIONS.map((action) => [action, ACTION_LABELS[action] || MSG.PERMISSIONS?.[action] || action])
);

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

  const userPermissions = user.permissions || [];

  // 管理员拥有所有权限
  const effectivePermissions = userPermissions.includes('admin:full')
    ? [...POLICY_ACTIONS]
    : userPermissions;

  return c.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, type: user.type },
      permissions: effectivePermissions,
      isAdmin: userPermissions.includes('admin:full'),
    },
  });
});

/**
 * POST /api/v1/permissions/check - 批量检查权限
 */
app.post('/check', async (c) => {
  const user = c.get('user');
  const { permissions } = await c.req.json();

  if (!Array.isArray(permissions)) {
    return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
  }

  const userPermissions = user.permissions || [];
  const isAdmin = userPermissions.includes('admin:full');

  const results = {};
  for (const perm of permissions) {
    results[perm] = isAdmin || userPermissions.includes(perm);
  }

  return c.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name },
      permissions: results,
    },
  });
});

export default app;
