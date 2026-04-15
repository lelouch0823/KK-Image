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
import { getChinaDateStr } from '../../../../_shared/utils.js';
import { GoodsOverviewRepository } from '../../../../repositories/GoodsOverviewRepository.js';
import { withCache } from '../../middleware/cache.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();
app.use('*', requirePermission('products:manage'));

const readGoodsOverviewFilters = (url) => ({
    category: url.searchParams.get('category') || '',
    brand: url.searchParams.get('brand') || '',
    shortageOnly: url.searchParams.get('shortageOnly') === '1',
    sort: url.searchParams.get('sort') || 'shortage',
});

const neutralizeSpreadsheetFormula = (value) => {
    const normalized = value === null || value === undefined ? '' : String(value);
    return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
};

/**
 * GET / — 变体管道分析列表
 *
 * Query params:
 *   - category: 按分类筛选
 *   - brand: 按品牌筛选
 *   - shortageOnly: '1' 仅显示缺货变体
 *   - sort: 排序字段 (shortage / demand / name)，默认 shortage
 */
app.get('/', withCache(20), async (c) => {
    const { env } = c;
    const url = new URL(c.req.url);

    const filters = readGoodsOverviewFilters(url);

    const overviewRepo = new GoodsOverviewRepository(env.DB);
    const [items, availableFilters] = await Promise.all([
        overviewRepo.getList(filters),
        overviewRepo.getAvailableFilters()
    ]);

    return c.json({
        success: true,
        data: { items, filters: availableFilters },
    });
});

/**
 * GET /summary — 管道概览统计
 */
app.get('/summary', withCache(20), async (c) => {
    const { env } = c;

    const overviewRepo = new GoodsOverviewRepository(env.DB);
    const summaryData = await overviewRepo.getSummary();

    return c.json({
        success: true,
        data: summaryData,
    });
});

/**
 * GET /export — CSV 导出
 */
app.get('/export', async (c) => {
    const { env } = c;

    const overviewRepo = new GoodsOverviewRepository(env.DB);
    const url = new URL(c.req.url);
    const filters = readGoodsOverviewFilters(url);
    const results = await overviewRepo.getList(filters);

    const escapeCSV = (v) => `"${neutralizeSpreadsheetFormula(v).replace(/"/g, '""')}"`;

    const headers = ['商品名称', '变体', 'SKU', '品牌', '分类', '当前库存', '待订货', '生产中', '运输中', '已到货', '总需求', '订单数', '缺口', '入货成本', '运费分摊', '关税分摊', '到岸成本'];
    const rows = results.map(r => [
        escapeCSV(r.name),
        escapeCSV(r.variantLabel || '-'),
        escapeCSV(r.sku),
        escapeCSV(r.brand),
        escapeCSV(r.category),
        r.stockQuantity,
        r.confirmedQty,
        r.productionQty,
        r.shippingQty,
        r.arrivedQty,
        r.totalDemand,
        r.orderCount,
        r.shortage,
        r.avgUnitCost,
        r.avgFreight,
        r.avgTariff,
        r.landedCost,
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

export default app;
