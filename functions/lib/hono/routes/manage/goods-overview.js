/**
 * 订货总览 API (Goods Overview)
 * ==============================
 *
 * 根据已确认且已绑定商品的订单，聚合各商品的分状态需求量，
 * 对比库存计算缺口，帮助管理端掌握供应全链路状态。
 *
 * 有效状态: confirmed / production / shipping / arrived
 * 排除: pending（未确认）/ rejected / void / delivered
 * 排除: product_id IS NULL（未绑定商品的订单）
 *
 * @module routes/manage/goods-overview
 */

import { Hono } from 'hono';
import { getChinaDateStr } from '../../_shared/utils.js';

const app = new Hono();

/** 有效订单状态（纳入统计） */
const ACTIVE_STATUSES = ['confirmed', 'production', 'shipping', 'arrived'];
const STATUS_IN_CLAUSE = ACTIVE_STATUSES.map(() => '?').join(',');

/**
 * GET / — 商品管道分析列表
 *
 * Query params:
 *   - category: 按分类筛选
 *   - brand: 按品牌筛选
 *   - shortageOnly: '1' 仅显示缺货商品
 *   - sort: 排序字段 (shortage / demand / name)，默认 shortage
 */
app.get('/', async (c) => {
    const { env } = c;
    const url = new URL(c.req.url);

    const category = url.searchParams.get('category') || '';
    const brand = url.searchParams.get('brand') || '';
    const shortageOnly = url.searchParams.get('shortageOnly') === '1';
    const sort = url.searchParams.get('sort') || 'shortage';

    // 构建 WHERE 子句
    let productWhere = "p.status = 'active'";
    const bindParams = [...ACTIVE_STATUSES]; // 用于 IN 子句

    if (category) {
        productWhere += ' AND p.category = ?';
        bindParams.push(category);
    }
    if (brand) {
        productWhere += ' AND p.brand = ?';
        bindParams.push(brand);
    }

    // 排序
    let orderBy;
    switch (sort) {
        case 'demand':
            orderBy = 'total_demand DESC, shortage DESC';
            break;
        case 'name':
            orderBy = 'p.name ASC';
            break;
        case 'shortage':
        default:
            orderBy = 'shortage DESC, total_demand DESC';
            break;
    }

    // HAVING 子句 - 仅缺货 or 全部
    const havingClause = shortageOnly ? 'HAVING shortage > 0' : 'HAVING total_demand > 0';

    const sql = `
        SELECT 
            p.id, p.name, p.sku, p.brand, p.category, 
            p.stock_quantity, p.alert_threshold, p.images,
            COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.quantity ELSE 0 END), 0) as confirmed_qty,
            COALESCE(SUM(CASE WHEN o.status = 'production' THEN o.quantity ELSE 0 END), 0) as production_qty,
            COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN o.quantity ELSE 0 END), 0) as shipping_qty,
            COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN o.quantity ELSE 0 END), 0) as arrived_qty,
            COALESCE(SUM(o.quantity), 0) as total_demand,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.quantity), 0) - p.stock_quantity as shortage
        FROM products p
        INNER JOIN orders o ON o.product_id = p.id 
            AND o.status IN (${STATUS_IN_CLAUSE})
        WHERE ${productWhere}
        GROUP BY p.id
        ${havingClause}
        ORDER BY ${orderBy}
    `;

    const { results } = await env.DB.prepare(sql).bind(...bindParams).all();

    // 获取可用的品牌和分类（用于前端筛选下拉）
    const { results: categories } = await env.DB
        .prepare("SELECT DISTINCT category FROM products WHERE status = 'active' AND category IS NOT NULL AND category != '' ORDER BY category")
        .all();

    const { results: brands } = await env.DB
        .prepare("SELECT DISTINCT brand FROM products WHERE status = 'active' AND brand IS NOT NULL AND brand != '' ORDER BY brand")
        .all();

    return c.json({
        success: true,
        data: {
            items: results.map(mapItem),
            filters: {
                categories: categories.map(r => r.category),
                brands: brands.map(r => r.brand),
            },
        },
    });
});

/**
 * GET /summary — 管道概览统计
 */
app.get('/summary', async (c) => {
    const { env } = c;

    /**
     * 按商品聚合后的统计
     * - products: 各状态下涉及的 **不同商品数**（用户最关心的数字）
     * - qty: 各状态下的总件数
     * - orders: 各状态下的订单条数
     */
    const { results } = await env.DB.prepare(`
        SELECT 
            COUNT(DISTINCT p.id) as total_products,
            COALESCE(SUM(o.quantity), 0) as total_demand,
            -- 不同商品数
            COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN p.id END) as confirmed_products,
            COUNT(DISTINCT CASE WHEN o.status = 'production' THEN p.id END) as production_products,
            COUNT(DISTINCT CASE WHEN o.status = 'shipping'  THEN p.id END) as shipping_products,
            COUNT(DISTINCT CASE WHEN o.status = 'arrived'   THEN p.id END) as arrived_products,
            -- 件数
            COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.quantity ELSE 0 END), 0) as confirmed_qty,
            COALESCE(SUM(CASE WHEN o.status = 'production' THEN o.quantity ELSE 0 END), 0) as production_qty,
            COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN o.quantity ELSE 0 END), 0) as shipping_qty,
            COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN o.quantity ELSE 0 END), 0) as arrived_qty,
            -- 订单条数
            COUNT(CASE WHEN o.status = 'confirmed' THEN 1 END) as confirmed_orders,
            COUNT(CASE WHEN o.status = 'production' THEN 1 END) as production_orders,
            COUNT(CASE WHEN o.status = 'shipping' THEN 1 END) as shipping_orders,
            COUNT(CASE WHEN o.status = 'arrived' THEN 1 END) as arrived_orders
        FROM orders o
        INNER JOIN products p ON o.product_id = p.id AND p.status = 'active'
        WHERE o.product_id IS NOT NULL
            AND o.status IN (${STATUS_IN_CLAUSE})
    `).bind(...ACTIVE_STATUSES).all();

    const row = results[0] || {};

    // 缺货商品数 — 需要单独统计
    const { results: shortageResults } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM (
            SELECT p.id,
                COALESCE(SUM(o.quantity), 0) - p.stock_quantity as shortage
            FROM products p
            INNER JOIN orders o ON o.product_id = p.id 
                AND o.status IN (${STATUS_IN_CLAUSE})
            WHERE p.status = 'active'
            GROUP BY p.id
            HAVING shortage > 0
        )
    `).bind(...ACTIVE_STATUSES).all();

    return c.json({
        success: true,
        data: {
            totalProducts: row.total_products || 0,
            totalDemand: row.total_demand || 0,
            shortageCount: shortageResults[0]?.count || 0,
            byStatus: {
                confirmed: { products: row.confirmed_products || 0, count: row.confirmed_orders || 0, qty: row.confirmed_qty || 0 },
                production: { products: row.production_products || 0, count: row.production_orders || 0, qty: row.production_qty || 0 },
                shipping: { products: row.shipping_products || 0, count: row.shipping_orders || 0, qty: row.shipping_qty || 0 },
                arrived: { products: row.arrived_products || 0, count: row.arrived_orders || 0, qty: row.arrived_qty || 0 },
            },
        },
    });
});

/**
 * GET /export — CSV 导出
 */
app.get('/export', async (c) => {
    const { env } = c;

    const { results } = await env.DB.prepare(`
        SELECT 
            p.name, p.sku, p.brand, p.category, p.stock_quantity,
            COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.quantity ELSE 0 END), 0) as confirmed_qty,
            COALESCE(SUM(CASE WHEN o.status = 'production' THEN o.quantity ELSE 0 END), 0) as production_qty,
            COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN o.quantity ELSE 0 END), 0) as shipping_qty,
            COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN o.quantity ELSE 0 END), 0) as arrived_qty,
            COALESCE(SUM(o.quantity), 0) as total_demand,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.quantity), 0) - p.stock_quantity as shortage
        FROM products p
        INNER JOIN orders o ON o.product_id = p.id 
            AND o.status IN (${STATUS_IN_CLAUSE})
        WHERE p.status = 'active'
        GROUP BY p.id
        HAVING total_demand > 0
        ORDER BY shortage DESC, total_demand DESC
    `).bind(...ACTIVE_STATUSES).all();

    const escapeCSV = (v) => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);

    const headers = ['商品名称', 'SKU', '品牌', '分类', '当前库存', '待订货', '生产中', '运输中', '已到货', '总需求', '订单数', '缺口'];
    const rows = results.map(r => [
        escapeCSV(r.name),
        escapeCSV(r.sku),
        escapeCSV(r.brand),
        escapeCSV(r.category),
        r.stock_quantity,
        r.confirmed_qty,
        r.production_qty,
        r.shipping_qty,
        r.arrived_qty,
        r.total_demand,
        r.order_count,
        r.shortage,
    ].join(','));

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const filename = `goods_overview_${getChinaDateStr()}.csv`;

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
});

/**
 * 映射单条商品分析数据
 */
function mapItem(row) {
    let images = [];
    try {
        images = row.images ? JSON.parse(row.images) : [];
    } catch { /* ignore */ }

    return {
        id: row.id,
        name: row.name,
        sku: row.sku,
        brand: row.brand || '',
        category: row.category || '',
        stockQuantity: row.stock_quantity || 0,
        alertThreshold: row.alert_threshold || 10,
        images,
        confirmedQty: row.confirmed_qty,
        productionQty: row.production_qty,
        shippingQty: row.shipping_qty,
        arrivedQty: row.arrived_qty,
        totalDemand: row.total_demand,
        orderCount: row.order_count,
        shortage: row.shortage,
    };
}

export default app;
