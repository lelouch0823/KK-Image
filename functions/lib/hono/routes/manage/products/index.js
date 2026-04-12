import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { CommandIdempotencyRepository } from '../../../../../repositories/CommandIdempotencyRepository.js';
import { parseJsonArray, parseJsonObject } from '../../../../../api/utils/json.js';
import { withCache } from '../../../middleware/cache.js';
import { requirePermission } from '../../../middleware/auth.js';
import { parsePagination } from '../../../_shared/route-helpers.js';
import { createManagedProduct } from './create-product.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import batch from './batch.js';
import exportRoute from './export.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { BadRequestError } from '../../../errors.js';
import {
    cleanupReservedCommand,
    parseStoredResponse,
    replayReservedCommand,
    resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';

const app = new Hono();
const PRODUCT_CREATE_COMMAND_TYPE = 'product_create';
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'products', action: 'product.create', severity: 'high', targetType: 'product' },
]);
app.use('*', requirePermission('products:manage'));

app.route('/batch', batch);
app.route('/export', exportRoute);

function getIdempotencyKey(c) {
    const requestKey = String(c.req.header('Idempotency-Key') || '').trim();
    return requestKey || crypto.randomUUID();
}

function normalizeProductCreateFingerprintValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeProductCreateFingerprintValue(item));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                const normalized = normalizeProductCreateFingerprintValue(value[key]);
                if (normalized !== undefined) {
                    acc[key] = normalized;
                }
                return acc;
            }, {});
    }

    return value;
}

function buildProductCreateRequestFingerprint(body = {}) {
    return JSON.stringify(normalizeProductCreateFingerprintValue(body));
}

function getCreateCommandScopeKey(c) {
    const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
    return `${PRODUCT_CREATE_COMMAND_TYPE}:${actorId}`;
}

function isDuplicateOutboxIdempotencyError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('unique constraint failed')
        && (
            message.includes('domain_outbox.idempotency_key')
            || message.includes('idx_domain_outbox_idempotency_key')
        )
    );
}

async function publishProductCreatedCacheEvent(c, productId, { commandId, correlationId } = {}) {
    try {
        await scheduleProductCacheInvalidation(c, {
            eventType: 'product_created',
            productIds: [productId],
        }, {
            commandId,
            correlationId,
        });
    } catch (error) {
        if (!isDuplicateOutboxIdempotencyError(error)) {
            throw error;
        }
    }
}

async function reserveProductCreateCommand(c, { requestFingerprint }) {
    const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
    const idempotencyKey = getIdempotencyKey(c);
    const reservation = await commandIdempotencyRepo.reserveCommand(
        PRODUCT_CREATE_COMMAND_TYPE,
        getCreateCommandScopeKey(c),
        idempotencyKey,
        requestFingerprint
    );

    if (reservation?.existing) {
        if (reservation.record?.request_fingerprint !== requestFingerprint) {
            throw new BadRequestError('同一个幂等键不能提交不同的商品创建请求');
        }

        const storedResponse = parseStoredResponse(reservation.record?.response_json);
        if (reservation.record?.status === 'failed' && storedResponse) {
            return {
                replay: null,
                resume: storedResponse,
                reservation,
                commandIdempotencyRepo,
            };
        }

        return {
            replay: replayReservedCommand(reservation, requestFingerprint, {
                mismatchMessage: '同一个幂等键不能提交不同的商品创建请求',
                inFlightMessage: '当前幂等键对应的商品创建命令仍在处理中',
            }),
            resume: null,
            reservation,
            commandIdempotencyRepo,
        };
    }

    return {
        replay: null,
        resume: null,
        reservation,
        commandIdempotencyRepo,
    };
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
        meta: {
            total: result.total,
            page: result.page,
            limit: result.limit
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
        meta: {
            total,
            page,
            limit,
        },
    });
});

/**
 * POST / - 创建商品
 */
app.post('/', async (c) => {
    const body = await c.req.json();
    const requestFingerprint = buildProductCreateRequestFingerprint(body);
    const {
        replay,
        resume,
        reservation,
        commandIdempotencyRepo,
    } = await reserveProductCreateCommand(c, { requestFingerprint });

    if (replay) {
        return c.json({ success: true, data: replay }, 201);
    }

    if (resume) {
        await publishProductCreatedCacheEvent(c, resume.id, {
            commandId: reservation.record?.command_id,
            correlationId: reservation.record?.command_id,
        });
        await commandIdempotencyRepo
            .buildFinalizeStatement(reservation.record?.command_id, resume)
            .run();
        return c.json({ success: true, data: resume }, 201);
    }

    const ownsReservation = resolveReservationOwnership(reservation);
    let product = null;

    try {
        product = await createManagedProduct(c, body, {
            skipCacheInvalidation: true,
        });
        await publishProductCreatedCacheEvent(c, product.id, {
            commandId: reservation.record?.command_id,
            correlationId: reservation.record?.command_id,
        });
        await commandIdempotencyRepo
            .buildFinalizeStatement(reservation.record?.command_id, product)
            .run();
    } catch (error) {
        if (product) {
            try {
                await commandIdempotencyRepo
                    .buildFinalizeStatement(reservation.record?.command_id, product, 'failed')
                    .run();
            } catch (finalizeError) {
                console.error('Product create idempotency finalize failed:', finalizeError);
            }
        } else {
            await cleanupReservedCommand({
                commandIdempotencyRepo,
                db: c.env.DB,
                ownsReservation,
                commandId: reservation.record?.command_id,
            });
        }
        throw error;
    }

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
    return c.json({ success: true, data: product }, 201);
});

export default app;
