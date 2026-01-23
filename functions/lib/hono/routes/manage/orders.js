import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
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
    return c.json({ success: true, data: order });
});

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = await c.req.json();

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findById(id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const updatesObj = body.updates || body;
    const { reason, fileIds, ...updates } = updatesObj;

    const { processOrderUpdate } = await import('../../../../api/utils/order-utils.js');

    // 管理员允许修改的所有字段
    const ADMIN_EDITABLE_FIELDS = ['name', 'brand', 'series', 'size', 'color', 'material', 'remark', 'deadline'];

    const _result = await processOrderUpdate({
        env,
        orderId: id,
        orderNo: order.orderNo,
        currentData: order.currentData,
        updates,
        fileIds,
        allowedFields: ADMIN_EDITABLE_FIELDS,
        actor: { type: 'admin', id: 'admin', name: 'Admin' }, // 这里可以优化为从 JWT 获取管理员名称，如果实现了多管理员
        reason: reason || 'Admin Update',
    });

    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
});

/**
 * PATCH /:id/status - 更新订单状态
 */
app.patch('/:id/status', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const { status, reason } = await c.req.json();
    const repo = new OrderRepository(env.DB);
    const success = await repo.updateStatus(id, status, 'admin');
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
