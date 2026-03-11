import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateUserSchema, UpdateUserSchema } from '../../schemas/user.js';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, hashPassword, MSG } from '../../_shared/utils.js';
import { logAudit, getAuditContext } from '../../../../api/utils/audit.js';
import { parseJsonArray } from '../../../../api/utils/json.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors.js';
import { assertKnownPermissions } from './_shared/permissions-validation.js';
import { appendOptionalUpdate, requireEntity } from '../../_shared/route-helpers.js';

const app = new Hono();
const USER_SELECT_FIELDS = 'id, username, name, email, role, permissions, created_at, updated_at';

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: parseJsonArray(user.permissions, []),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * GET /api/v1/users - 获取用户列表（管理员）
 */
app.get('/', requirePermission('admin:full'), async (c) => {
  const { env } = c;

  const { results } = await env.DB.prepare(`SELECT ${USER_SELECT_FIELDS} FROM users`).all();
  const safeUsers = results.map(toSafeUser);

  return c.json({ success: true, data: safeUsers });
});

/**
 * GET /api/v1/users/me - 获取当前用户
 */
app.get('/me', async (c) => {
  const user = c.get('user');

  return c.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      type: user.type,
      permissions: user.permissions || [],
    },
  });
});

/**
 * GET /api/v1/users/:id - 获取单个用户
 */
app.get('/:id', requirePermission('admin:full'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const user = await requireEntity(
    env.DB.prepare(`SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = ?`)
      .bind(id)
      .first(),
    () => new NotFoundError(MSG.USER.NOT_FOUND)
  );

  return c.json({
    success: true,
    data: toSafeUser(user),
  });
});

/**
 * POST /api/v1/users - 创建用户
 */
app.post('/', requirePermission('admin:full'), zValidator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json');
  const { env } = c;
  assertKnownPermissions(data.permissions);

  // 检查用户名是否已存在
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(data.username)
    .first();

  if (existing) throw new ConflictError(MSG.USER.EXISTS);

  const id = generateId();
  const passwordHash = await hashPassword(data.password, env.JWT_SECRET);
  const nowMs = Date.now();
  const permissions = JSON.stringify(data.permissions || []);

  await env.DB.prepare(
    `INSERT INTO users (id, username, password_hash, name, email, role, permissions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      data.username,
      passwordHash,
      data.name || null,
      data.email || null,
      data.role || 'user',
      permissions,
      nowMs
    )
    .run();

  // 审计日志 (SOTA: 非阻塞记录)
  const { userId: opUserId, ip } = getAuditContext(c);
  c.executionCtx.waitUntil(logAudit(env.DB, { userId: opUserId, action: 'user:create', targetType: 'user', targetId: id, payload: { username: data.username, role: data.role || 'user' }, ip }));

  return c.json(
    {
      success: true,
      data: {
        id,
        username: data.username,
        name: data.name,
        email: data.email,
        role: data.role || 'user',
        permissions: data.permissions || [],
        createdAt: nowMs,
      },
    },
    201
  );
});

/**
 * PUT /api/v1/users/:id - 更新用户
 */
app.put(
  '/:id',
  requirePermission('admin:full'),
  zValidator('json', UpdateUserSchema),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const { env } = c;
    assertKnownPermissions(data.permissions);

    await requireEntity(
      env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first(),
      () => new NotFoundError(MSG.USER.NOT_FOUND)
    );

    const updates = [];
    const values = [];

    appendOptionalUpdate(updates, values, 'name = ?', data.name);
    appendOptionalUpdate(updates, values, 'email = ?', data.email);
    appendOptionalUpdate(updates, values, 'role = ?', data.role);
    appendOptionalUpdate(updates, values, 'permissions = ?', data.permissions, (value) => JSON.stringify(value));
    if (data.password) {
      updates.push('password_hash = ?');
      values.push(await hashPassword(data.password, env.JWT_SECRET));
    }

    if (updates.length === 0) {
      throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // 获取更新后的用户
    const user = await env.DB.prepare(`SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = ?`)
      .bind(id)
      .first();

    return c.json({
      success: true,
      data: toSafeUser(user),
    });
  }
);

/**
 * DELETE /api/v1/users/:id - 删除用户
 */
app.delete('/:id', requirePermission('admin:full'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const { env } = c;

  if (currentUser.id === id) {
    throw new BadRequestError(MSG.USER.CANNOT_DELETE_SELF);
  }

  await requireEntity(
    env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first(),
    () => new NotFoundError(MSG.USER.NOT_FOUND)
  );

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

  // 审计日志 (SOTA: 非阻塞记录)
  const { userId: opUserId, ip } = getAuditContext(c);
  c.executionCtx.waitUntil(logAudit(env.DB, { userId: opUserId, action: 'user:delete', targetType: 'user', targetId: id, ip }));

  return c.json({ success: true, message: MSG.USER.DELETE_SUCCESS });
});

export default app;
