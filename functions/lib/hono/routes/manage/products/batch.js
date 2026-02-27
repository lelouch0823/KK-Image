import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { invalidateCache, getProductCacheUrls } from '../../../middleware/cache.js';
import { BadRequestError } from '../../../errors.js';

const app = new Hono();

export const buildVariantMatchKey = (variant) => {
    if (variant.variant_code) return `code:${variant.variant_code}`;
    if (variant.sku) return `sku:${variant.sku}`;
    
    const opts = variant.options_values || {};
    const sig = Object.keys(opts)
        .sort()
        .map(k => `${k}:${opts[k]}`)
        .join('|');
        
    return `sig:${sig}`;
};

export const mergeIncomingWithExisting = (existingVariants, incomingVariants) => {
    const existingMap = new Map();
    existingVariants.forEach(v => {
        existingMap.set(buildVariantMatchKey(v), v);
    });
    
    const incomingMap = new Map();
    const merged = [];
    
    incomingVariants.forEach(incoming => {
        const key = buildVariantMatchKey(incoming);
        incomingMap.set(key, true);
        
        const existing = existingMap.get(key);
        if (existing) {
            merged.push({
                ...incoming,
                id: existing.id
            });
        } else {
            merged.push(incoming);
        }
    });
    
    existingVariants.forEach(v => {
        const key = buildVariantMatchKey(v);
        if (!incomingMap.has(key)) {
            merged.push(v);
        }
    });
    
    return merged;
};

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('Invalid items array');
    }

    if (items.length > 500) {
        throw new BadRequestError('Batch size limit exceeded (max 500)');
    }

    const repo = new ProductRepository(env.DB);
    const variantRepo = new ProductVariantRepository(env.DB);
    
    const summary = {
        createdProducts: 0,
        updatedProducts: 0,
        createdVariants: 0,
        updatedVariants: 0,
        failedProducts: 0
    };
    
    const errors = [];
    
    for (const item of items) {
        try {
            const spu = item.spu ? String(item.spu).trim() : null;
            let productId;
            let isNew = false;
            
            if (spu) {
                const existing = await repo.findBySpu(spu);
                if (existing) {
                    productId = existing.id;
                    const updateData = { ...item };
                    delete updateData.variants;
                    await repo.updateWithMeta(productId, updateData);
                    summary.updatedProducts++;
                }
            }
            
            if (!productId) {
                const createData = { ...item };
                delete createData.variants;
                const newProduct = await repo.create(createData);
                productId = newProduct.id;
                isNew = true;
                summary.createdProducts++;
            }
            
            if (item.variants && item.variants.length > 0) {
                const existingVariants = isNew ? [] : await variantRepo.findByProductId(productId);
                const variantsToSync = mergeIncomingWithExisting(existingVariants, item.variants);

                const syncResult = await variantRepo.syncVariants(productId, variantsToSync);
                summary.createdVariants += syncResult.createdCount || 0;
                summary.updatedVariants += syncResult.updatedCount || 0;
            }
        } catch (error) {
            summary.failedProducts++;
            errors.push(`Failed to process item ${item.spu || item.name}: ${error.message}`);
        }
    }

    const success = summary.createdProducts > 0 || summary.updatedProducts > 0;
    
    const result = {
        success,
        count: summary.createdProducts + summary.updatedProducts,
        summary,
        errors
    };

    if (success) {
        c.executionCtx.waitUntil(invalidateCache(getProductCacheUrls(c)));
    }

    return c.json(result);
});

export default app;
