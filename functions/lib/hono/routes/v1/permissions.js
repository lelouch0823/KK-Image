import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();

// 权限常量
const PERMISSIONS = {
    'files:read': '读取文件',
    'files:write': '创建/编辑文件',
    'files:delete': '删除文件',
    'folders:read': '读取文件夹',
    'folders:write': '创建/编辑文件夹',
    'folders:delete': '删除文件夹',
    'users:read': '查看用户',
    'users:write': '管理用户',
    'webhooks:read': '查看 Webhooks',
    'webhooks:write': '管理 Webhooks',
    'stats:read': '查看统计',
    'admin:full': '完全管理员权限'
};

const ROLES = {
    admin: {
        name: '管理员',
        permissions: ['admin:full']
    },
    user: {
        name: '普通用户',
        permissions: ['files:read', 'files:write', 'folders:read', 'folders:write']
    },
    viewer: {
        name: '访客',
        permissions: ['files:read', 'folders:read']
    }
};

/**
 * GET /api/v1/permissions - 获取权限定义
 */
app.get('/', async (c) => {
    return c.json({
        success: true,
        data: {
            permissions: PERMISSIONS,
            roles: ROLES
        }
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
        ? Object.keys(PERMISSIONS)
        : userPermissions;

    return c.json({
        success: true,
        data: {
            user: { id: user.id, name: user.name, type: user.type },
            permissions: effectivePermissions,
            isAdmin: userPermissions.includes('admin:full')
        }
    });
});

/**
 * POST /api/v1/permissions/check - 批量检查权限
 */
app.post('/check', async (c) => {
    const user = c.get('user');
    const { permissions } = await c.req.json();

    if (!Array.isArray(permissions)) {
        return c.json({ success: false, error: 'permissions must be an array' }, 400);
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
            permissions: results
        }
    });
});

export default app;
