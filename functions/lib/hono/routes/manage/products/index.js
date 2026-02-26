import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { withCache, invalidateCache } from '../../../middleware/cache.js';
import { BadRequestError, ConflictError } from '../../../errors.js';

const getProductCacheUrls = (c) => {
    const origin = new URL(c.req.url).origin;
    return [
        `${origin}/api/manage/products`,
        `${origin}/api/manage/products?page=1&limit=20`,
    ];
};
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
 * POST / - 创建商品
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();

    if (!body.name) {
        throw new BadRequestError('Name is required');
    }
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
                await dimensionRepo.addValue(product.id, created.id, {
                    value,
                    sort_order: j,
                });
            }
        }

        const normalizedVariants = normalizeVariantsWithDimensions(body.variants, createdDimensions);
        const variantRepo = new ProductVariantRepository(env.DB);
        await variantRepo.createBatch(product.id, normalizedVariants);
    } catch (error) {
        // Compensating rollback: keep product+variant writes all-or-nothing for create flow.
        if (product?.id) {
            await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(product.id).run();
        }
        throw error;
    }

    c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));

    return c.json({ success: true, data: product }, 201);
});

export default app;
