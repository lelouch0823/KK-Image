import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { resolveVariantImageSyncPlan } from './variant-image-sync.js';
import { normalizeProductCurrency } from './currency.js';
import { withCache, invalidateCache, getProductCacheUrls } from '../../../middleware/cache.js';
import { getAllSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import { BadRequestError, ConflictError } from '../../../errors.js';
import { getSalesProductCacheUrls } from '../../_shared/cache-urls.js';
import batch from './batch.js';
import exportRoute from './export.js';

const app = new Hono();

app.route('/batch', batch);
app.route('/export', exportRoute);

const REQUIRED_VARIANT_FIELDS = ['price', 'cost_price', 'stock_quantity', 'alert_threshold', 'status'];

const isEmptyValue = (value) => value === undefined || value === null || value === '';

const buildDimensionNameMap = (dimensions = []) =>
    (dimensions || []).reduce((acc, item) => {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        if (name && id) acc[name] = id;
        return acc;
    }, {});

const normalizeVariantsWithDimensions = (variants = [], dimensions = []) => {
    const nameMap = buildDimensionNameMap(dimensions);
    return (variants || []).map((variant) => {
        const normalized = {};
        for (const [key, value] of Object.entries(variant?.options_values || {})) {
            const rawKey = String(key || '').trim();
            const nextKey = nameMap[rawKey] || rawKey;
            if (!nextKey) continue;
            if (value === undefined || value === null || String(value).trim() === '') continue;
            normalized[nextKey] = String(value);
        }
        return {
            ...variant,
            options_values: normalized,
            barcode: String(variant?.barcode ?? '').trim() || null,
            supplier_sku: String(variant?.supplier_sku ?? '').trim() || null,
        };
    });
};

const validateVariants = (variants) => {
    if (!Array.isArray(variants) || variants.length === 0) {
        throw new BadRequestError('At least one variant is required');
    }

    for (const [index, variant] of variants.entries()) {
        if (!variant || typeof variant !== 'object') {
            throw new BadRequestError(`Variant #${index + 1} is invalid`);
        }
        for (const field of REQUIRED_VARIANT_FIELDS) {
            if (isEmptyValue(variant[field])) {
                throw new BadRequestError(`Variant #${index + 1} missing required field: ${field}`);
            }
        }
    }
};

const parseJsonSafe = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const invalidateProductCaches = (c, db, productId = null) => {
    c.executionCtx.waitUntil((async () => {
        const salesTokens = await getAllSalespersonAccessTokens(db);
        const urls = [
            ...getProductCacheUrls(c),
            ...getSalesProductCacheUrls(c, { salesTokens, productId }),
        ];
        await invalidateCache([...new Set(urls)]);
    })());
};

/**
 * GET / - 搜索商品列表
 * SOTA: 使用边缘缓存 (TTL 60s) 减少 DB 压力
 */
app.get('/', withCache(60), async (c) => {
    const { env } = c;
    const { search, category, brand, status, page = 1, limit = 20 } = c.req.query();

    const repo = new ProductRepository(env.DB);
    const result = await repo.search({
        search,
        category,
        brand,
        status,
        page: parseInt(page),
        limit: parseInt(limit)
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
            page: parseInt(page),
            limit: parseInt(limit)
        }
    });
});

/**
 * GET /variants - active variant list for purchase-order picker
 */
app.get('/variants', withCache(30), async (c) => {
    const { env } = c;
    const { search = '', page = 1, limit = 50 } = c.req.query();

    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (normalizedPage - 1) * normalizedLimit;
    const keyword = String(search || '').trim();

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
        pv.stock_quantity,
        pv.alert_threshold,
        pv.moq,
        pv.pack_size,
        pv.order_step,
        pv.image_id AS variant_image_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      ${where}
      ORDER BY p.updated_at DESC, p.created_at DESC, pv.created_at ASC
      LIMIT ? OFFSET ?
    `;

    const countResult = await env.DB.prepare(countSql).bind(...binds).all();
    const total = Number(countResult?.results?.[0]?.total || 0);

    const listResult = await env.DB.prepare(listSql).bind(...binds, normalizedLimit, offset).all();
    const items = (listResult?.results || []).map((row) => {
        const productImages = parseJsonSafe(row.product_images, []);
        const variantOptions = parseJsonSafe(row.variant_options, {});
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
            page: normalizedPage,
            limit: normalizedLimit,
        },
    });
});

/**
 * POST / - 创建商品
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();

    if (!body.name) {
        throw new BadRequestError('Name is required');
    }
    const normalizedCurrency = normalizeProductCurrency(body.currency);
    if (!normalizedCurrency) {
        throw new BadRequestError('Invalid currency code');
    }
    body.currency = normalizedCurrency;
    validateVariants(body.variants);

    const repo = new ProductRepository(env.DB);

    const normalizedSpu = typeof body.spu === 'string' ? body.spu.trim() : '';

    // 仅在 spu 非空时检查唯一性
    if (normalizedSpu) {
        body.spu = normalizedSpu;
        const existing = await repo.findBySpu(normalizedSpu);
        if (existing) {
            throw new ConflictError('SPU already exists');
        }
    }

    let product = null;
    try {
        product = await repo.create(body);

        const dimensionRepo = new ProductDimensionRepository(env.DB);
        const inputDimensions = Array.isArray(body.dimensions) ? body.dimensions : [];
        const createdDimensions = [];
        for (let i = 0; i < inputDimensions.length; i++) {
            const input = inputDimensions[i] || {};
            const created = await dimensionRepo.createDimension(product.id, {
                name: input.name,
                sort_order: Number.isInteger(input.sort_order) ? input.sort_order : i,
            });
            createdDimensions.push(created);
            const values = Array.isArray(input.values) ? input.values : [];
            for (let j = 0; j < values.length; j++) {
                const rawValue = values[j];
                const value = typeof rawValue === 'string' ? rawValue : rawValue?.value;
                if (!String(value || '').trim()) continue;
                const payload = {
                    value,
                    sort_order: j,
                };
                if (rawValue && typeof rawValue === 'object' && Object.prototype.hasOwnProperty.call(rawValue, 'meta')) {
                    payload.meta = rawValue.meta;
                }
                await dimensionRepo.addValue(product.id, created.id, payload);
            }
        }

        const normalizedVariants = normalizeVariantsWithDimensions(body.variants, createdDimensions);
        const variantRepo = new ProductVariantRepository(env.DB);
        const createdVariants = await variantRepo.createBatch(product.id, normalizedVariants);

        const variantImageRepo = new VariantImageRepository(env.DB, variantRepo);
        const imageSyncPlan = resolveVariantImageSyncPlan({
            inputVariants: normalizedVariants,
            persistedVariants: createdVariants,
        });
        if (imageSyncPlan.unresolved.length > 0) {
            throw new BadRequestError(
                `Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`
            );
        }
        for (const task of imageSyncPlan.tasks) {
            await variantImageRepo.syncImages(product.id, task.variantId, task.images);
        }
    } catch (error) {
        // Compensating rollback: keep product+variant writes all-or-nothing for create flow.
        if (product?.id) {
            await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(product.id).run();
        }
        throw error;
    }

    invalidateProductCaches(c, env.DB, product?.id || null);

    return c.json({ success: true, data: product }, 201);
});

export default app;
