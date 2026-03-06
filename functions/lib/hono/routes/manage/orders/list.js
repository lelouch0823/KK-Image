import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { OrderStatsRepository } from '../../../../../repositories/OrderStatsRepository.js';
import { MSG, ORDER_STATUSES, ORDER_PROCUREMENT_STATUSES, getChinaDayStart, getChinaDateStr } from '../../../_shared/utils.js';
import { parsePagination } from '../../../_shared/route-helpers.js';
import { withCache } from '../../../middleware/cache.js';

const app = new Hono();

/**
 * GET / - 获取订单列表
 */
app.get('/', withCache(20), async (c) => {
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const salespersonId = c.req.query('salesperson');
    const status = c.req.query('status');
    const procurementStatus = c.req.query('procurementStatus');
    const search = c.req.query('search');
    const startTime = parseInt(c.req.query('startTime') || '0', 10);
    const endTime = parseInt(c.req.query('endTime') || '0', 10);

    const orderRepo = new OrderRepository(env.DB);
    const [result, { results: salespersons }] = await Promise.all([
        orderRepo.listForAdmin({
            salespersonId,
            status: status && ORDER_STATUSES.includes(status) ? status : null,
            procurementStatus: procurementStatus && ORDER_PROCUREMENT_STATUSES.includes(procurementStatus)
                ? procurementStatus
                : null,
            search,
            startTime,
            endTime,
            page,
            limit,
        }),
        env.DB.prepare(
            'SELECT id, name, store FROM salespersons WHERE is_active = 1 ORDER BY name'
        ).all()
    ]);

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
            procurementStatuses: ORDER_PROCUREMENT_STATUSES,
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
app.get('/stats', withCache(20), async (c) => {
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
    const procurementStatus = url.searchParams.get('procurementStatus');
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
    if (procurementStatus && ORDER_PROCUREMENT_STATUSES.includes(procurementStatus)) {
        whereClause += " AND COALESCE(o.procurement_status, 'none') = ?";
        bindParams.push(procurementStatus);
    }
    if (search) {
        whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
        const searchPattern = `%${search}%`;
        bindParams.push(searchPattern, searchPattern);
    }

    const { DateUtils } = await import('../../../_shared/utils.js');
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

export default app;
