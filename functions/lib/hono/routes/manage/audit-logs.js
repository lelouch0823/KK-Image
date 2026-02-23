import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();

/**
 * GET /api/manage/audit-logs - 获取审计日志列表
 * 支持分页和过滤
 */
app.get('/', requirePermission('admin:full'), async (c) => {
    const { env } = c;
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '50', 10);
    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const targetType = c.req.query('targetType');
    const offset = (page - 1) * pageSize;

    try {
        let whereClause = '';
        const conditions = [];
        const bindings = [];

        if (userId) {
            conditions.push('user_id = ?');
            bindings.push(userId);
        }
        if (action) {
            conditions.push('action = ?');
            bindings.push(action);
        }
        if (targetType) {
            conditions.push('target_type = ?');
            bindings.push(targetType);
        }

        if (conditions.length > 0) {
            whereClause = `WHERE ${conditions.join(' AND ')}`;
        }

        // 查询总数
        const countResult = await env.DB.prepare(
            `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
        )
            .bind(...bindings)
            .first();

        // 查询分页数据
        const { results } = await env.DB.prepare(
            `SELECT id, user_id, action, target_type, target_id, payload, ip_address, created_at
       FROM audit_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
        )
            .bind(...bindings, pageSize, offset)
            .all();

        return c.json({
            success: true,
            data: results,
            pagination: {
                page,
                pageSize,
                total: countResult?.total || 0,
                totalPages: Math.ceil((countResult?.total || 0) / pageSize),
            },
        });
    } catch (err) {
        console.error('[AuditLogs] 查询失败:', err);
        return c.json({ success: false, error: `查询审计日志失败: ${err.message}` }, 500);
    }
});

/**
 * GET /api/manage/audit-logs/actions - 获取所有可用的审计动作类型
 */
app.get('/actions', requirePermission('admin:full'), async (c) => {
    const { env } = c;

    try {
        const { results } = await env.DB.prepare(
            'SELECT DISTINCT action FROM audit_logs ORDER BY action'
        ).all();

        return c.json({
            success: true,
            data: results.map((r) => r.action),
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default app;
