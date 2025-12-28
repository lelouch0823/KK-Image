import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateUserSchema, UpdateUserSchema } from '../../schemas/user.js';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, hashPassword } from '../../../../api/utils/id.js';

const app = new Hono();

/**
 * GET /api/v1/users - 获取用户列表（管理员）
 */
app.get('/',
    requirePermission('admin:full'),
    async (c) => {
        const { env } = c;

        try {
            const { results } = await env.DB.prepare(
                'SELECT id, username, name, email, role, permissions, created_at, updated_at FROM users'
            ).all();

            const safeUsers = results.map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                email: u.email,
                role: u.role,
                permissions: u.permissions ? JSON.parse(u.permissions) : [],
                createdAt: u.created_at,
                updatedAt: u.updated_at
            }));

            return c.json({ success: true, data: safeUsers });
        } catch (err) {
            console.error('获取用户列表失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

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
            permissions: user.permissions || []
        }
    });
});

/**
 * GET /api/v1/users/:id - 获取单个用户
 */
app.get('/:id',
    requirePermission('admin:full'),
    async (c) => {
        const id = c.req.param('id');
        const { env } = c;

        try {
            const user = await env.DB.prepare(
                'SELECT id, username, name, email, role, permissions, created_at, updated_at FROM users WHERE id = ?'
            ).bind(id).first();

            if (!user) {
                return c.json({ success: false, error: '用户不存在' }, 404);
            }

            return c.json({
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions ? JSON.parse(user.permissions) : [],
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            });
        } catch (err) {
            console.error('获取用户失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

/**
 * POST /api/v1/users - 创建用户
 */
app.post('/',
    requirePermission('admin:full'),
    zValidator('json', CreateUserSchema),
    async (c) => {
        const data = c.req.valid('json');
        const { env } = c;

        try {
            // 检查用户名是否已存在
            const existing = await env.DB.prepare(
                'SELECT id FROM users WHERE username = ?'
            ).bind(data.username).first();

            if (existing) {
                return c.json({ success: false, error: '用户名已存在' }, 409);
            }

            const id = generateId();
            const passwordHash = await hashPassword(data.password, env.JWT_SECRET);
            const now = Date.now();
            const permissions = JSON.stringify(data.permissions || []);

            await env.DB.prepare(`
                INSERT INTO users (id, username, password_hash, name, email, role, permissions, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id,
                data.username,
                passwordHash,
                data.name || null,
                data.email || null,
                data.role || 'user',
                permissions,
                now
            ).run();

            return c.json({
                success: true,
                data: {
                    id,
                    username: data.username,
                    name: data.name,
                    email: data.email,
                    role: data.role || 'user',
                    permissions: data.permissions || [],
                    createdAt: now
                }
            }, 201);
        } catch (err) {
            console.error('创建用户失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

/**
 * PUT /api/v1/users/:id - 更新用户
 */
app.put('/:id',
    requirePermission('admin:full'),
    zValidator('json', UpdateUserSchema),
    async (c) => {
        const id = c.req.param('id');
        const data = c.req.valid('json');
        const { env } = c;

        try {
            const existing = await env.DB.prepare(
                'SELECT id FROM users WHERE id = ?'
            ).bind(id).first();

            if (!existing) {
                return c.json({ success: false, error: '用户不存在' }, 404);
            }

            const updates = [];
            const values = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name);
            }
            if (data.email !== undefined) {
                updates.push('email = ?');
                values.push(data.email);
            }
            if (data.role !== undefined) {
                updates.push('role = ?');
                values.push(data.role);
            }
            if (data.permissions !== undefined) {
                updates.push('permissions = ?');
                values.push(JSON.stringify(data.permissions));
            }
            if (data.password) {
                updates.push('password_hash = ?');
                values.push(await hashPassword(data.password, env.JWT_SECRET));
            }

            if (updates.length === 0) {
                return c.json({ success: false, error: '没有可更新的字段' }, 400);
            }

            updates.push('updated_at = ?');
            values.push(Date.now());
            values.push(id);

            await env.DB.prepare(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
            ).bind(...values).run();

            // 获取更新后的用户
            const user = await env.DB.prepare(
                'SELECT id, username, name, email, role, permissions, created_at, updated_at FROM users WHERE id = ?'
            ).bind(id).first();

            return c.json({
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions ? JSON.parse(user.permissions) : [],
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            });
        } catch (err) {
            console.error('更新用户失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

/**
 * DELETE /api/v1/users/:id - 删除用户
 */
app.delete('/:id',
    requirePermission('admin:full'),
    async (c) => {
        const id = c.req.param('id');
        const currentUser = c.get('user');
        const { env } = c;

        if (currentUser.id === id) {
            return c.json({ success: false, error: '不能删除自己的账户' }, 400);
        }

        try {
            const existing = await env.DB.prepare(
                'SELECT id FROM users WHERE id = ?'
            ).bind(id).first();

            if (!existing) {
                return c.json({ success: false, error: '用户不存在' }, 404);
            }

            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

            return c.json({ success: true, message: '用户已删除' });
        } catch (err) {
            console.error('删除用户失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

export default app;
