import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { OrderStatsRepository } from '../../../../../repositories/OrderStatsRepository.js';
import { mapOrderListItem } from '../../../../../repositories/order/helpers.js';
import { parseJsonObject } from '../../../../../api/utils/json.js';
import {
    expandOrderStatusFilter,
    MSG,
    ORDER_DELIVERY_STATUSES,
    ORDER_FILTER_STATUSES,
    normalizeOrderDeliveryStatusFilter,
    normalizeOrderStatusFilter,
    ORDER_PROCUREMENT_STATUSES,
    normalizeOrderProcurementStatus,
    getChinaDayStart,
    getChinaDateStr,
    DateUtils,
} from '../../../../../_shared/utils.js';
import { parsePagination } from '../../../_shared/route-helpers.js';
import { withCache } from '../../../middleware/cache.js';
import {
    ORDER_LINE_PRIMARY_SNAPSHOT_JOIN,
    ORDER_LINE_STATUS_AGGREGATE_JOIN,
    appendOrderDeliveryStatusFilter,
    appendOrderProductSearchFilter,
    appendOrderProgressStatusFilter,
} from '../../../../../repositories/order/sql.js';

/** 导出订单的最大行数 */
const MAX_EXPORT_LIMIT = 10_000;

const app = new Hono();

const neutralizeSpreadsheetFormula = (value) => {
    const normalized = value === null || value === undefined ? '' : String(value);
    return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
};

/**
 * GET / - 获取订单列表
 */
app.get('/', async (c) => {
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const salespersonId = c.req.query('salesperson');
    const status = c.req.query('status');
    const procurementStatus = c.req.query('procurementStatus');
    const deliveryStatus = c.req.query('deliveryStatus');
    const search = c.req.query('search');
    const startTime = parseInt(c.req.query('startTime') || '0', 10);
    const endTime = parseInt(c.req.query('endTime') || '0', 10);

    const orderRepo = new OrderRepository(env.DB);
    const [result, { results: salespersons }] = await Promise.all([
        orderRepo.listForAdmin({
            salespersonId,
            status: normalizeOrderStatusFilter(status),
            procurementStatus: normalizeOrderProcurementStatus(procurementStatus),
            deliveryStatus: normalizeOrderDeliveryStatusFilter(deliveryStatus),
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
        data: result.items,
        pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        },
        salespersons: salespersons.map((s) => ({
            id: s.id,
            name: s.name,
            store: s.store,
        })),
        statuses: ORDER_FILTER_STATUSES,
        procurementStatuses: ORDER_PROCUREMENT_STATUSES,
        deliveryStatuses: ORDER_DELIVERY_STATUSES,
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
            awaitingDeliveryCount: stats.awaitingDelivery || 0,
            deliveredCount: stats.delivered || 0,
            partiallyReturnedCount: stats.partiallyReturned || 0,
            returnedCount: stats.returned || 0,
            statusDistribution: stats.statusDistribution,
            deliveryStatusDistribution: stats.deliveryStatusDistribution || {},
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
    const deliveryStatus = url.searchParams.get('deliveryStatus');
    const search = url.searchParams.get('search');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    // 支持按 ID 列表筛选（批量导出选中订单）
    const ids = url.searchParams.getAll('ids').filter(Boolean);

    let whereClause = '1=1';
    const bindParams = [];

    // 如果指定了 IDs，优先使用 IDs 筛选
    if (ids.length > 0) {
        whereClause += ` AND o.id IN (${ids.map(() => '?').join(', ')})`;
        bindParams.push(...ids);
    }

    if (salespersonId && ids.length === 0) {
        whereClause += ' AND o.salesperson_id = ?';
        bindParams.push(salespersonId);
    }

    // 当指定 IDs 时，跳过其他筛选条件（精确导出选中订单）
    if (ids.length === 0) {
        const statusValues = expandOrderStatusFilter(status);
        if (statusValues.length === 1) {
            whereClause += ' AND o.status = ?';
            bindParams.push(statusValues[0]);
        } else if (statusValues.length > 1) {
            whereClause += ` AND o.status IN (${statusValues.map(() => '?').join(', ')})`;
            bindParams.push(...statusValues);
        }
        whereClause = appendOrderProgressStatusFilter(
            whereClause,
            bindParams,
            normalizeOrderProcurementStatus(procurementStatus)
        );
        whereClause = appendOrderDeliveryStatusFilter(
            whereClause,
            bindParams,
            normalizeOrderDeliveryStatusFilter(deliveryStatus)
        );
        whereClause = appendOrderProductSearchFilter(whereClause, bindParams, search);

        if (fromDate) {
            whereClause += ' AND o.created_at >= ?';
            bindParams.push(DateUtils.parseChinaDate(fromDate));
        }
        if (toDate) {
            whereClause += ' AND o.created_at <= ?';
            bindParams.push(DateUtils.parseChinaDate(toDate) + 86400000);
        }
    }

    const { results: orders } = await env.DB.prepare(`
    SELECT
      o.*,
      order_line_agg.ordered_qty as line_ordered_qty,
      order_line_agg.shipped_qty as line_shipped_qty,
      order_line_agg.returned_qty as line_returned_qty,
      order_line_agg.cancelled_qty as line_cancelled_qty,
      order_line_snapshot.snapshot_name as snapshot_name,
      s.name as salesperson_name,
      s.store as salesperson_store
    FROM orders o
    ${ORDER_LINE_STATUS_AGGREGATE_JOIN}
    ${ORDER_LINE_PRIMARY_SNAPSHOT_JOIN}
    LEFT JOIN salespersons s ON o.salesperson_id = s.id
    WHERE ${whereClause}
    ORDER BY o.created_at DESC
    LIMIT ${MAX_EXPORT_LIMIT}
    `).bind(...bindParams).all();

    // CSV generation logic (concise)
    const columns = [
        { key: 'order_no', label: MSG.EXPORT.HEADERS.ORDER_NO },
        { key: 'product_name', label: MSG.EXPORT.HEADERS.PRODUCT_NAME },
        { key: 'status', label: MSG.EXPORT.HEADERS.STATUS },
        { key: 'fulfillment_status', label: MSG.EXPORT.HEADERS.FULFILLMENT_STATUS },
        { key: 'delivery_status', label: MSG.EXPORT.HEADERS.DELIVERY_STATUS },
        { key: 'returned_quantity', label: MSG.EXPORT.HEADERS.RETURNED_QUANTITY },
        { key: 'salesperson', label: MSG.EXPORT.HEADERS.SALESPERSON },
        { key: 'created_at', label: MSG.EXPORT.HEADERS.CREATED_AT },
    ];

    const escapeCSV = (v) => `"${neutralizeSpreadsheetFormula(v).replace(/"/g, '""')}"`;

    const header = columns.map(c => c.label).join(',');
    const rows = orders.map(o => {
        const data = parseJsonObject(o.current_data, {});
        const mapped = mapOrderListItem(o);
        return [
            escapeCSV(o.order_no),
            escapeCSV(data.name || o.snapshot_name || ''),
            escapeCSV(MSG.ORDER.STATUS?.[mapped.status] || MSG.ORDER.STATUS?.[o.status] || o.status),
            escapeCSV(MSG.ORDER.FULFILLMENT_STATUS?.[mapped.fulfillmentStatus] || mapped.fulfillmentStatus),
            escapeCSV(MSG.ORDER.DELIVERY_STATUS?.[mapped.deliveryStatus] || mapped.deliveryStatus),
            escapeCSV(Number(o.line_returned_qty || 0)),
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
