import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateUserSchema, UpdateUserSchema } from '../../schemas/user.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();

/**
 * GET /api/v1/users - 获取用户列表（管理员）
 */
app.get('/',
    requirePermission('admin:full'),
    async (c) => {
        const { env } = c;

        if (!env.USERS_KV) {
            return c.json({
                success: true,
                data: [],
                message: 'Users KV not configured'
            });
        }

        const users = await env.USERS_KV.get('users', 'json') || [];

        // 移除敏感信息
        const safeUsers = users.map(({ passwordHash, ...user }) => user);

        return c.json({ success: true, data: safeUsers });
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

        if (!env.USERS_KV) {
            return c.json({ success: false, error: 'Users KV not configured' }, 503);
        }

        const users = await env.USERS_KV.get('users', 'json') || [];
        const user = users.find(u => u.id === id);

        if (!user) {
            return c.json({ success: false, error: '用户不存在' }, 404);
        }

        const { passwordHash, ...safeUser } = user;
        return c.json({ success: true, data: safeUser });
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

        if (!env.USERS_KV) {
            return c.json({ success: false, error: 'Users KV not configured' }, 503);
        }

        const users = await env.USERS_KV.get('users', 'json') || [];

        // 检查用户名是否已存在
        if (users.some(u => u.username === data.username)) {
            return c.json({ success: false, error: '用户名已存在' }, 409);
        }

        // 哈希密码
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(data.password + (env.JWT_SECRET || 'salt'));
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
        const passwordHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const newUser = {
            id: crypto.randomUUID(),
            username: data.username,
            passwordHash,
            name: data.name,
            email: data.email,
            role: data.role,
            permissions: data.permissions || [],
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await env.USERS_KV.put('users', JSON.stringify(users));

        const { passwordHash: _, ...safeUser } = newUser;
        return c.json({ success: true, data: safeUser }, 201);
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

        if (!env.USERS_KV) {
            return c.json({ success: false, error: 'Users KV not configured' }, 503);
        }

        const users = await env.USERS_KV.get('users', 'json') || [];
        const index = users.findIndex(u => u.id === id);

        if (index === -1) {
            return c.json({ success: false, error: '用户不存在' }, 404);
        }

        // 更新用户
        const updatedUser = { ...users[index] };

        if (data.name !== undefined) updatedUser.name = data.name;
        if (data.email !== undefined) updatedUser.email = data.email;
        if (data.role !== undefined) updatedUser.role = data.role;
        if (data.permissions !== undefined) updatedUser.permissions = data.permissions;

        if (data.password) {
            const encoder = new TextEncoder();
            const passwordData = encoder.encode(data.password + (env.JWT_SECRET || 'salt'));
            const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
            updatedUser.passwordHash = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }

        updatedUser.updatedAt = new Date().toISOString();
        users[index] = updatedUser;

        await env.USERS_KV.put('users', JSON.stringify(users));

        const { passwordHash, ...safeUser } = updatedUser;
        return c.json({ success: true, data: safeUser });
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

        if (!env.USERS_KV) {
            return c.json({ success: false, error: 'Users KV not configured' }, 503);
        }

        const users = await env.USERS_KV.get('users', 'json') || [];
        const filteredUsers = users.filter(u => u.id !== id);

        if (filteredUsers.length === users.length) {
            return c.json({ success: false, error: '用户不存在' }, 404);
        }

        await env.USERS_KV.put('users', JSON.stringify(filteredUsers));

        return c.json({ success: true, message: '用户已删除' });
    }
);

export default app;
