import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, now, MSG, verifyJWT } from '../../_shared/utils.js';
import { parse as parseCookie } from 'cookie';

const app = new Hono();

// 订单状态列表
const ORDER_STATUSES = ['pending', 'confirmed', 'rejected', 'production', 'shipping', 'arrived', 'delivered'];

// Schemas
const UpdateOrderSchema = z.object({
    updates: z.record(z.string()).optional(),
    reason: z.string().min(1).max(500)
});

const ChangeStatusSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'rejected', 'production', 'shipping', 'arrived', 'delivered']),
    note: z.string().max(500).optional()
});

const AddCommentSchema = z.object({
    comment: z.string().min(1).max(1000)
});

/**
 * 获取当前管理员信息
 */
async function getAdmin(c) {
    const user = c.get('user');

    if (!user) {
        throw new Error(MSG.AUTH.REQUIRED);
    }

    return user;
}

/**
 * 记录时间轴
 */
async function logTimeline(db, params) {
    const {
        orderId,
        actionType,
        actorType,
        actorId,
        actorName,
        fieldName = null,
        oldValue = null,
        newValue = null,
        reason = null,
        comment = null
    } = params;

    await db.prepare(`
        INSERT INTO order_timeline (id, order_id, action_type, actor_type, actor_id, actor_name, field_name, old_value, new_value, reason, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        generateId(),
        orderId,
        actionType,
        actorType,
        actorId,
        actorName,
        fieldName,
        oldValue,
        newValue,
        reason,
        comment,
        now()
    ).run();
}

/**
 * GET /api/manage/orders - 获取订单列表
 */
app.get('/', async (c) => {
    const { env } = c;

    try {
        const url = new URL(c.req.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const salespersonId = url.searchParams.get('salesperson');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        const bindParams = [];

        if (salespersonId) {
            whereClause += ' AND o.salesperson_id = ?';
            bindParams.push(salespersonId);
        }

        if (status && ORDER_STATUSES.includes(status)) {
            whereClause += ' AND o.status = ?';
            bindParams.push(status);
        }

        if (search) {
            whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
            const searchPattern = `%${search}%`;
            bindParams.push(searchPattern, searchPattern);
        }

        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}
        `).bind(...bindParams).first();

        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.id, o.order_no, o.salesperson_id, o.current_data, o.status, 
                o.has_new_feedback, o.main_image_id, o.created_at, o.updated_at,
                s.name as salesperson_name, s.store as salesperson_store,
                f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...bindParams, limit, offset).all();

        const formattedOrders = orders.map(order => {
            const currentData = order.current_data ? JSON.parse(order.current_data) : {};
            return {
                id: order.id,
                orderNo: order.order_no,
                productName: currentData.name || '',
                status: order.status,
                hasNewFeedback: !!order.has_new_feedback,
                mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
                salesperson: {
                    id: order.salesperson_id,
                    name: order.salesperson_name,
                    store: order.salesperson_store
                },
                createdAt: order.created_at,
                updatedAt: order.updated_at
            };
        });

        const { results: salespersons } = await env.DB.prepare(`
            SELECT id, name, store FROM salespersons WHERE is_active = 1 ORDER BY name
        `).all();

        return c.json({
            success: true,
            data: {
                orders: formattedOrders,
                salespersons: salespersons.map(s => ({
                    id: s.id,
                    name: s.name,
                    store: s.store
                })),
                statuses: ORDER_STATUSES,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    totalPages: Math.ceil(countResult.total / limit)
                }
            }
        });
    } catch (err) {
        console.error('Order list error:', err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * GET /api/manage/orders/:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    try {
        const order = await env.DB.prepare(`
            SELECT o.*, 
                   s.name as salesperson_name, s.store as salesperson_store, s.phone as salesperson_phone,
                   f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ?
        `).bind(id).first();

        if (!order) {
            return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
        }

        const { results: files } = await env.DB.prepare(`
            SELECT of.section, of.sort_order, f.id, f.original_name, f.storage_key, f.mime_type, f.size
            FROM order_files of
            JOIN files f ON of.file_id = f.id
            WHERE of.order_id = ?
            ORDER BY of.section, of.sort_order
        `).bind(id).all();

        const { results: timeline } = await env.DB.prepare(`
            SELECT id, action_type, actor_type, actor_name, field_name, old_value, new_value, reason, comment, created_at
            FROM order_timeline
            WHERE order_id = ?
            ORDER BY created_at DESC
        `).bind(id).all();

        const originalData = order.original_data ? JSON.parse(order.original_data) : {};
        const currentData = order.current_data ? JSON.parse(order.current_data) : {};

        return c.json({
            success: true,
            data: {
                id: order.id,
                orderNo: order.order_no,
                status: order.status,
                hasNewFeedback: !!order.has_new_feedback,
                originalData,
                currentData,
                mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
                mainImageId: order.main_image_id,
                salesperson: {
                    id: order.salesperson_id,
                    name: order.salesperson_name,
                    store: order.salesperson_store,
                    phone: order.salesperson_phone
                },
                files: files.map(f => ({
                    id: f.id,
                    name: f.original_name,
                    url: `/file/${f.storage_key}`,
                    mimeType: f.mime_type,
                    size: f.size,
                    section: f.section
                })),
                timeline: timeline.map(t => ({
                    id: t.id,
                    actionType: t.action_type,
                    actorType: t.actor_type,
                    actorName: t.actor_name,
                    fieldName: t.field_name,
                    oldValue: t.old_value,
                    newValue: t.new_value,
                    reason: t.reason,
                    comment: t.comment,
                    createdAt: t.created_at
                })),
                createdAt: order.created_at,
                updatedAt: order.updated_at
            }
        });
    } catch (err) {
        console.error('Order detail error:', err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * POST /api/manage/orders/:id/update - 更新订单信息
 */
app.post('/:id/update',
    requirePermission('orders:write'),
    zValidator('json', UpdateOrderSchema),
    async (c) => {
        const { env } = c;
        const id = c.req.param('id');
        const { updates, reason } = c.req.valid('json');

        try {
            const admin = await getAdmin(c);

            if (!updates || Object.keys(updates).length === 0) {
                return c.json({ success: false, error: MSG.COMMON.NO_UPDATE_FIELDS }, 400);
            }

            const order = await env.DB.prepare('SELECT id, current_data FROM orders WHERE id = ?').bind(id).first();
            if (!order) {
                return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
            }

            const currentData = order.current_data ? JSON.parse(order.current_data) : {};
            const newData = { ...currentData };
            const timelinePromises = [];

            for (const [field, value] of Object.entries(updates)) {
                if (currentData[field] !== value) {
                    timelinePromises.push(logTimeline(env.DB, {
                        orderId: id,
                        actionType: 'field_updated',
                        actorType: 'admin',
                        actorId: admin.id,
                        actorName: admin.name,
                        fieldName: field,
                        oldValue: currentData[field] || '',
                        newValue: value || '',
                        reason: reason.trim()
                    }));
                    newData[field] = value;
                }
            }

            if (timelinePromises.length === 0) {
                return c.json({ success: false, error: MSG.COMMON.NO_UPDATE_FIELDS }, 400);
            }

            await env.DB.prepare('UPDATE orders SET current_data = ?, has_new_feedback = 1, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(newData), now(), id).run();

            await Promise.all(timelinePromises);

            return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
        } catch (err) {
            if (err.message === MSG.AUTH.REQUIRED) {
                return c.json({ success: false, message: err.message }, 401);
            }
            console.error('Order update error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * PATCH /api/manage/orders/:id/status - 变更订单状态
 */
app.patch('/:id/status',
    requirePermission('orders:write'),
    zValidator('json', ChangeStatusSchema),
    async (c) => {
        const { env } = c;
        const id = c.req.param('id');
        const { status, note } = c.req.valid('json');

        try {
            const admin = await getAdmin(c);

            const order = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(id).first();
            if (!order) {
                return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
            }

            if (order.status === status) {
                return c.json({ success: false, error: '状态未变更' }, 400);
            }

            await env.DB.prepare('UPDATE orders SET status = ?, has_new_feedback = 1, updated_at = ? WHERE id = ?')
                .bind(status, now(), id).run();

            await logTimeline(env.DB, {
                orderId: id,
                actionType: 'status_changed',
                actorType: 'admin',
                actorId: admin.id,
                actorName: admin.name,
                oldValue: order.status,
                newValue: status,
                reason: note || null
            });

            return c.json({ success: true, message: MSG.ORDER.STATUS_CHANGED });
        } catch (err) {
            if (err.message === MSG.AUTH.REQUIRED) {
                return c.json({ success: false, message: err.message }, 401);
            }
            console.error('Order status change error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * POST /api/manage/orders/:id/comment - 添加管理员留言
 */
app.post('/:id/comment',
    requirePermission('orders:write'),
    zValidator('json', AddCommentSchema),
    async (c) => {
        const { env } = c;
        const id = c.req.param('id');
        const { comment } = c.req.valid('json');

        try {
            const admin = await getAdmin(c);

            const order = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first();
            if (!order) {
                return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
            }

            await logTimeline(env.DB, {
                orderId: id,
                actionType: 'comment',
                actorType: 'admin',
                actorId: admin.id,
                actorName: admin.name,
                comment: comment.trim()
            });

            await env.DB.prepare('UPDATE orders SET has_new_feedback = 1, updated_at = ? WHERE id = ?')
                .bind(now(), id).run();

            return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
        } catch (err) {
            if (err.message === MSG.AUTH.REQUIRED) {
                return c.json({ success: false, message: err.message }, 401);
            }
            console.error('Order comment error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
        }
    }
);

export default app;
