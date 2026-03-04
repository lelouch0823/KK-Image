import { Hono } from 'hono';
import { UnauthorizedError } from '../../errors.js';
import { requirePermission } from '../../middleware/auth.js';
import { normalizeUserContext } from '../../_shared/auth-context.js';

const app = new Hono();
app.use('*', requirePermission('users:read'));

/**
 * GET /api/manage/user - 获取当前用户信息
 */
app.get('/', (c) => {
  const rawUser = c.get('user');

  // 如果没有用户（中间件未通过），通常会先被 authMiddleware 拦截
  // 但为了安全起见，这里再检查一次
  if (!rawUser) throw new UnauthorizedError('Unauthorized');
  const user = normalizeUserContext(rawUser);

  return c.json({
    success: true,
    data: {
      id: user.id,
      name: user.name || user.username || 'Admin',
      role: user.role,
      permissions: user.permissions,
      type: user.type,
      avatar: user.avatar || '/assets/default-avatar.png',
      email: user.email,
    },
  });
});

export default app;
