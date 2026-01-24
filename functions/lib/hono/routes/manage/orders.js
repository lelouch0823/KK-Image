import { Hono } from 'hono';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { OrderStatsRepository } from '../../../../repositories/OrderStatsRepository.js';
import { MSG, ORDER_STATUSES, getChinaDayStart, getChinaDateStr } from '../../_shared/utils.js';

const app = new Hono();

/**
 * GET / - 获取订单列表
 */
app.get('/', async (c) => {
    const { env } = c;
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const salespersonId = url.searchParams.get('salesperson');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const startTime = parseInt(url.searchParams.get('startTime') || '0', 10);
    const endTime = parseInt(url.searchParams.get('endTime') || '0', 10);

    const orderRepo = new OrderRepository(env.DB);
    const result = await orderRepo.listForAdmin({
        salespersonId,
        status: status && ORDER_STATUSES.includes(status) ? status : null,
        search,
        startTime,
        endTime,
        page,
        limit,
    });

    const { results: salespersons } = await env.DB.prepare(
        'SELECT id, name, store FROM salespersons WHERE is_active = 1 ORDER BY name'
    ).all();

    return c.json({
        success: true,
        data: {
            orders: result.items,
            salespersons: salespersons.map((s) => ({
                id: s.id,
                name: s.name,
                store: s.store,
            })),
            statuses: ORDER_STATUSES,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        },
    });
});

/**
 * POST / - 管理端创建订单
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const user = c.get('user'); // Admin user

    // Dynamic import to avoid top-level issues if any
    const { generateId, generateOrderNo, triggerWebhook } = await import('../../_shared/utils.js');
    const { NotificationRepository } = await import('../../../../repositories/NotificationRepository.js');

    // Validation (Simple version, or reuse schema)
    if (!body.productName || !body.salespersonId) {
        return c.json({ success: false, error: 'Product Name and Salesperson are required' }, 400);
    }

    const orderRepo = new OrderRepository(env.DB);
    const orderId = generateId();
    const orderNo = generateOrderNo();

    // 1. 创建订单
    await orderRepo.create({
        id: orderId,
        orderNo,
        salespersonId: body.salespersonId,
        data: {
            name: body.productName,
            brand: body.brand || '',
            series: body.series || '',
            sku: body.sku || '',
            size: body.size || '',
            color: body.color || '',
            material: body.material || '',
            remark: body.remark || '',
            deadline: body.deadline || '',
        },
        // Admin can set initial status
        status: body.status || 'pending',
        mainImageId: body.fileIds?.[0] || null,
        fileIds: body.fileIds || [],
        timeline: {
            actionType: 'created',
            actorType: 'admin',
            actorId: user?.id || 'admin',
            actorName: user?.name || 'Admin',
            comment: 'Admin created order', // Optional context
        },
    });

    // 2. 通知销售人员 (Async)
    c.executionCtx.waitUntil((async () => {
        try {
            const notifyRepo = new NotificationRepository(env.DB);
            // Notify Salesperson
            await notifyRepo.create({
                event: 'ORDER_ASSIGNED', // Or ORDER_CREATED
                orderId,
                orderNo,
                receiver: body.salespersonId, // Target the salesperson
                actorName: 'Admin',
            });

            // Webhook (if needed for admin creation)
            await triggerWebhook(env, 'order.created_by_admin', { orderId, orderNo, admin: user?.name });
        } catch (e) {
            console.error('Async notify failed:', e);
        }
    })());

    return c.json({ success: true, data: { id: orderId, orderNo } }, 201);
});

/**
 * GET /stats - 获取订单统计数据
 */
app.get('/stats', async (c) => {
    const { env } = c;
    const statsRepo = new OrderStatsRepository(env.DB);
    const todayStart = getChinaDayStart();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

    const stats = await statsRepo.getAdminStats(todayStart, weekStart, monthStart);

    const trendMap = new Map();
    stats.recentTrend.forEach((row) => trendMap.set(row.date, row.count));

    const monthTrend = [];
    for (let i = 29; i >= 0; i--) {
        const dateStr = getChinaDateStr(todayStart - i * 24 * 60 * 60 * 1000);
        monthTrend.push({
            date: dateStr,
            count: trendMap.get(dateStr) || 0,
        });
    }

    return c.json({
        success: true,
        data: {
            todayCount: stats.today,
            pendingCount: stats.statusDistribution['pending'] || 0,
            weekCount: stats.week,
            statusDistribution: stats.statusDistribution,
            monthTrend,
        },
    });
});

/**
 * GET /export - 导出订单为 CSV
 */
app.get('/export', async (c) => {
    const { env } = c;
    const url = new URL(c.req.url);
    const salespersonId = url.searchParams.get('salesperson');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

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

    const { DateUtils } = await import('../../_shared/utils.js');
    if (fromDate) {
        whereClause += ' AND o.created_at >= ?';
        bindParams.push(DateUtils.parseChinaDate(fromDate));
    }
    if (toDate) {
        whereClause += ' AND o.created_at <= ?';
        bindParams.push(DateUtils.parseChinaDate(toDate) + 86400000);
    }

    const { results: orders } = await env.DB.prepare(`
    SELECT o.*, s.name as salesperson_name, s.store as salesperson_store
    FROM orders o
    LEFT JOIN salespersons s ON o.salesperson_id = s.id
    WHERE ${whereClause}
    ORDER BY o.created_at DESC
    LIMIT 10000
  `).bind(...bindParams).all();

    // CSV generation logic (concise)
    const columns = [
        { key: 'order_no', label: MSG.EXPORT.HEADERS.ORDER_NO },
        { key: 'product_name', label: MSG.EXPORT.HEADERS.PRODUCT_NAME },
        { key: 'status', label: MSG.EXPORT.HEADERS.STATUS },
        { key: 'salesperson', label: MSG.EXPORT.HEADERS.SALESPERSON },
        { key: 'created_at', label: MSG.EXPORT.HEADERS.CREATED_AT },
    ];

    const escapeCSV = (v) => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);

    const header = columns.map(c => c.label).join(',');
    const rows = orders.map(o => {
        const data = JSON.parse(o.current_data || '{}');
        return [
            escapeCSV(o.order_no),
            escapeCSV(data.name),
            escapeCSV(MSG.ORDER.STATUS?.[o.status] || o.status),
            escapeCSV(o.salesperson_name),
            escapeCSV(getChinaDateStr(o.created_at))
        ].join(',');
    });

    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const filename = `orders_${getChinaDateStr()}.csv`;

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
});

/**
 * POST /batch - 批量操作接口
 */
app.post('/batch', async (c) => {
    const { env } = c;
    const { ids, action, value, reason } = await c.req.json();
    const repo = new OrderRepository(env.DB);

    if (action === 'status') {
        await repo.batchUpdateStatus(ids, value, {
            actorType: 'admin',
            reason: reason || MSG.ORDER.ACTIONS.BATCH_PREFIX + MSG.ORDER.ACTIONS[value]
        });
    }

    return c.json({ success: true, message: MSG.ORDER.BATCH_RESULT.replace('{valid}', ids.length) });
});

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new OrderRepository(env.DB);
    const order = await repo.findById(id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    // SOTA: 获取关联的文件和时间轴
    const { OrderTimelineRepository } = await import('../../../../repositories/OrderTimelineRepository.js');
    const timelineRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline] = await Promise.all([
        repo.getFiles(id),
        timelineRepo.getTimeline(id),
    ]);

    // 标记管理员已读
    await repo.markAsRead(id, 'admin');

    return c.json({
        success: true,
        data: {
            ...order,
            files,
            timeline,
        }
    });
});

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', async (c) => {
    const { env } = c;
    const user = c.get('user'); // 从 JWT 获取管理员信息
    const id = c.req.param('id');
    const body = await c.req.json();

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findById(id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const updatesObj = body.updates || body;
    const { reason, fileIds, ...updates } = updatesObj;

    const { processOrderUpdate } = await import('../../../../api/utils/order-utils.js');

    // 管理员允许修改的所有字段
    const ADMIN_EDITABLE_FIELDS = ['status', 'name', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline'];

    const _result = await processOrderUpdate({
        env,
        orderId: id,
        orderNo: order.orderNo,
        currentData: order.currentData,
        updates,
        fileIds,
        allowedFields: ADMIN_EDITABLE_FIELDS,
        actor: { type: 'admin', id: user?.id || 'admin', name: user?.name || 'Admin' },
        reason: reason || 'Admin Update',
    });

    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
});

/**
 * PATCH /:id/status - 更新订单状态
 */
app.patch('/:id/status', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const id = c.req.param('id');
    const { status, note } = await c.req.json();

    const repo = new OrderRepository(env.DB);
    const order = await repo.findById(id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const oldStatus = order.status;
    const success = await repo.updateStatus(id, status, 'admin');

    if (success) {
        // 记录状态变更到时间轴
        await repo.timelineRepo.addTimelineEntry(id, {
            actionType: 'status_changed',
            actorType: 'admin',
            actorId: user?.id || 'admin',
            actorName: user?.name || 'Admin',
            oldValue: oldStatus,
            newValue: status,
            reason: note || '',
        });
    }

    return c.json({ success: !!success, message: success ? MSG.ORDER.STATUS_CHANGED : MSG.COMMON.OP_FAILED });
});

/**
 * POST /:id/comment - 添加订单备注/留言
 */
app.post('/:id/comment', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const { content } = await c.req.json();
    const repo = new OrderRepository(env.DB);
    await repo.timelineRepo.add({ orderId: id, type: 'comment', content, actorType: 'admin' });
    return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

/**
 * DELETE /:id - 删除订单
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: MSG.ORDER.DELETE_SUCCESS });
});

export default app;
