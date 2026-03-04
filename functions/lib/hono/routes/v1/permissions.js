import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import {
  evaluateActionPermission,
  getPolicyActions,
  getPolicyMetadata,
} from '../../../authz/index.js';
import {
  findUnknownPermissions,
  formatUnknownPermissionsError,
} from './_shared/permissions-validation.js';

const app = new Hono();
const metadata = getPolicyMetadata();
const POLICY_ACTIONS = getPolicyActions();
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

async function evaluateUserAction(user, action) {
  return evaluateActionPermission({
    user,
    permission: action,
  });
}

async function evaluatePermissions(user, permissions) {
  const checks = await Promise.all(
    permissions.map(async (permission) => [permission, await evaluateUserAction(user, permission)])
  );
  return Object.fromEntries(checks);
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

  const decisionMap = await evaluatePermissions(user, POLICY_ACTIONS);
  const effectivePermissions = POLICY_ACTIONS.filter((action) => decisionMap[action]);
  const isAdmin = decisionMap['admin:full'] === true;

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
  const unknownPermissions = findUnknownPermissions(permissions);
  if (unknownPermissions.length > 0) {
    return c.json(
      {
        success: false,
        error: formatUnknownPermissionsError(unknownPermissions),
      },
      400
    );
  }

  const results = await evaluatePermissions(user, permissions);

  return c.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name },
      permissions: results,
    },
  });
});

export default app;
