import { Hono } from 'hono';
import { UnauthorizedError } from '../../errors.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();
app.use('*', requirePermission('users:read'));

/**
 * GET /api/manage/user - 获取当前用户信息
 */
app.get('/', (c) => {
  const user = c.get('user');

  // 如果没有用户（中间件未通过），通常会先被 authMiddleware 拦截
  // 但为了安全起见，这里再检查一次
  if (!user) throw new UnauthorizedError('Unauthorized');

  return c.json({
    success: true,
    data: {
      id: user.id,
      name: user.name || user.username || 'Admin',
      role: user.role || 'admin',
      permissions: user.permissions || [],
      avatar: user.avatar || '/assets/default-avatar.png',
      email: user.email,
    },
  });
});

export default app;
