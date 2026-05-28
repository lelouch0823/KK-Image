import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { parseJsonArray, parseJsonObject } from '../../../../../api/utils/json.js';
import { withCache } from '../../../middleware/cache.js';
import { requirePermission } from '../../../middleware/auth.js';
import { parsePagination } from '../../../_shared/route-helpers.js';
import { createManagedProduct } from './create-product.js';
import batch from './batch.js';
import exportRoute from './export.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { buildRequestFingerprint, publishProductCacheEvent, runIdempotentCommand } from './idempotency-helpers.js';
import { CreateProductSchema } from '../../../schemas/product.js';

const app = new Hono();
const PRODUCT_CREATE_COMMAND_TYPE = 'product_create';
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'products', action: 'product.create', severity: 'high', targetType: 'product' },
]);
app.use('*', requirePermission('products:manage'));

app.route('/batch', batch);
app.route('/export', exportRoute);

function buildProductCreateRequestFingerprint(body = {}) {
    return buildRequestFingerprint(body);
}

async function publishProductCreatedCacheEvent(c, productId, { commandId, correlationId } = {}) {
    await publishProductCacheEvent(c, 'product_created', [productId], { commandId, correlationId });
}

/**
 * GET / - 搜索商品列表
 * SOTA: 使用边缘缓存 (TTL 60s) 减少 DB 压力
 */
app.get('/', withCache(60), async (c) => {
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const search = c.req.query('search');
    const category = c.req.query('category');
    const brand = c.req.query('brand');
    const status = c.req.query('status');
    const hasStock = c.req.query('hasStock');
    const sortBy = c.req.query('sortBy');
    const sortOrder = c.req.query('sortOrder');

    const repo = new ProductRepository(env.DB);
    const result = await repo.search({
        search,
        category,
        brand,
        status,
        hasStock,
        sortBy,
        sortOrder,
        page,
        limit
    });
    const items = (result.items || []).map((item) => ({
        ...item,
        primaryImage: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null,
    }));

    return c.json({
        success: true,
        data: items,
        pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
        },
        filters: result.filters || { brands: [], categories: [] },
    });
});

/**
 * GET /variants - active variant list for purchase-order picker
 */
app.get('/variants', withCache(30), async (c) => {
    const { env } = c;
    const { page, limit, offset } = parsePagination(c, { limit: 50 });
    const keyword = String(c.req.query('search') || '').trim();

    let where = 'WHERE pv.status = ?';
    const binds = ['active'];
    if (keyword) {
        where += `
          AND (
            p.name LIKE ? OR p.brand LIKE ? OR p.spu LIKE ? OR pv.sku LIKE ? OR pv.variant_code LIKE ?
          )
        `;
        const like = `%${keyword}%`;
        binds.push(like, like, like, like, like);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      ${where}
    `;

    const listSql = `
      SELECT
        pv.id AS variant_id,
        pv.product_id,
        p.name AS product_name,
        p.brand,
        p.spu,
        p.images AS product_images,
        pv.sku AS variant_sku,
        pv.variant_code,
        pv.options_values AS variant_options,
        pv.cost_price,
        COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity,
        COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity,
        pv.alert_threshold,
        pv.moq,
        pv.pack_size,
        pv.order_step,
        pv.image_id AS variant_image_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
      ${where}
      ORDER BY p.updated_at DESC, p.created_at DESC, pv.created_at ASC
      LIMIT ? OFFSET ?
    `;

    const countResult = await env.DB.prepare(countSql).bind(...binds).all();
    const total = Number(countResult?.results?.[0]?.total || 0);

    const listResult = await env.DB.prepare(listSql).bind(...binds, limit, offset).all();
    const items = (listResult?.results || []).map((row) => {
        const productImages = parseJsonArray(row.product_images, []);
        const variantOptions = parseJsonObject(row.variant_options, {});
        return {
            variant_id: row.variant_id,
            product_id: row.product_id,
            product_name: row.product_name,
            brand: row.brand || '',
            spu: row.spu || '',
            sku: row.variant_sku || '',
            variant_code: row.variant_code || null,
            variant_options: variantOptions,
            stock_quantity: Number(row.stock_quantity || 0),
            available_quantity: Number(row.available_quantity || row.stock_quantity || 0),
            unit_cost: Number(row.cost_price || 0),
            moq: row.moq ?? null,
            pack_size: row.pack_size ?? null,
            order_step: row.order_step ?? null,
            image: row.variant_image_id || (Array.isArray(productImages) && productImages[0]) || null,
        };
    });

    return c.json({
        success: true,
        data: items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
});

/**
 * POST / - 创建商品
 */
app.post('/', zValidator('json', CreateProductSchema), async (c) => {
    const body = c.req.valid('json');
    const requestFingerprint = buildProductCreateRequestFingerprint(body);
    return runIdempotentCommand(c, {
        commandType: PRODUCT_CREATE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品创建请求',
        inFlightMessage: '当前幂等键对应的商品创建命令仍在处理中',
        successStatus: 201,
        execute: async () => {
            const product = await createManagedProduct(c, body, {
                skipCacheInvalidation: true,
            });
            return { success: true, data: product };
        },
        publish: async ({ responseBody, reservation }) => {
            await publishProductCreatedCacheEvent(c, responseBody?.data?.id, {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: async (responseBody) => {
            const product = responseBody?.data;
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.create',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: product.id,
                target_label: product.name,
                summary: `Created product ${product.name}`,
                metadata: { name: product.name, brand: product.brand || null },
            });
        },
    });
});

export default app;
