import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { BadRequestError } from '../../../errors.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';

const app = new Hono();
const IMPORT_MODE = {
    REPLACE: 'replace',
    SAFE_MERGE: 'safe_merge',
};

const appendLookup = (lookup, key, variant) => {
    if (!key) return;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(variant);
};

const pickUnmatchedVariant = (lookup, key, matchedIds) => {
    const list = lookup.get(key) || [];
    for (const item of list) {
        if (!matchedIds.has(item.id)) {
            return item;
        }
    }
    return null;
};

const normalizeImportMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === IMPORT_MODE.SAFE_MERGE) return IMPORT_MODE.SAFE_MERGE;
    return IMPORT_MODE.REPLACE;
};

const assertBatchItem = (item) => {
    const name = String(item?.name || '').trim();
    if (!name) {
        throw new Error('name is required');
    }
    item.name = name;

    if (!Array.isArray(item?.variants) || item.variants.length === 0) {
        throw new Error('at least one variant is required');
    }

    const seenSkus = new Set();
    item.variants.forEach((variant, index) => {
        const sku = String(variant?.sku || '').trim();
        if (!sku) {
            throw new Error(`variant #${index + 1} sku is required`);
        }
        if (seenSkus.has(sku)) {
            throw new Error(`variant sku duplicated: ${sku}`);
        }
        seenSkus.add(sku);
        variant.sku = sku;
    });
};

const isEmptyValue = (value) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

const normalizeObjectValue = (value) => {
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = value[key];
        return acc;
    }, {});
};

const areValuesEqual = (a, b) => {
    if (typeof a === 'object' || typeof b === 'object') {
        return JSON.stringify(normalizeObjectValue(a)) === JSON.stringify(normalizeObjectValue(b));
    }
    return String(a ?? '') === String(b ?? '');
};

const safeMergeField = ({ target, incoming, field, context, conflicts, currentValue }) => {
    if (!(field in incoming)) return;
    const incomingValue = incoming[field];
    if (isEmptyValue(incomingValue)) return;

    const baseValue = currentValue !== undefined ? currentValue : target[field];
    if (isEmptyValue(baseValue) || areValuesEqual(baseValue, incomingValue)) {
        target[field] = incomingValue;
        return;
    }

    conflicts.push({
        ...context,
        field,
        current: currentValue,
        incoming: incomingValue,
    });
};

const buildSafeProductUpdateData = (existing, incoming, conflicts) => {
    const next = {};
    const fields = ['name', 'spu', 'category', 'brand', 'series', 'description', 'currency', 'slug', 'images', 'specifications', 'options'];
    fields.forEach((field) => {
        safeMergeField({
            target: next,
            incoming,
            field,
            currentValue: existing?.[field],
            conflicts,
            context: {
                level: 'product',
                spu: String(existing?.spu || incoming?.spu || '').trim() || null,
            },
        });
    });
    return next;
};

const buildSafeVariantSyncPayload = (existingVariants, variantsToSync, conflicts, item) => {
    const existingById = new Map(existingVariants.map((variant) => [variant.id, variant]));
    const mutableFields = ['sku', 'price', 'cost_price', 'stock_quantity', 'alert_threshold', 'options_values', 'image_id', 'status', 'barcode', 'supplier_sku'];

    return variantsToSync.map((variant) => {
        if (!variant?.id || !existingById.has(variant.id)) {
            return variant;
        }
        const existing = existingById.get(variant.id);
        const merged = { ...existing };

        mutableFields.forEach((field) => {
            safeMergeField({
                target: merged,
                incoming: variant,
                field,
                conflicts,
                context: {
                    level: 'variant',
                    spu: String(item?.spu || '').trim() || null,
                    sku: String(existing?.sku || variant?.sku || '').trim() || null,
                },
            });
        });

        return {
            ...merged,
            id: existing.id,
        };
    });
};

export const buildVariantMatchKey = (variant) => {
    const variantCode = String(variant?.variant_code || '').trim();
    if (variantCode) return `code:${variantCode}`;

    const sku = String(variant?.sku || '').trim();
    if (sku) return `sku:${sku}`;

    const opts = variant?.options_values && typeof variant.options_values === 'object'
        ? variant.options_values
        : {};
    const entries = Object.entries(opts)
        .map(([k, v]) => [String(k || '').trim(), String(v || '').trim()])
        .filter(([k, v]) => k && v)
        .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return null;

    const sig = entries.map(([k, v]) => `${k}:${v}`).join('|');
    return `sig:${sig}`;
};

export const mergeIncomingWithExisting = (existingVariants, incomingVariants) => {
    const existingByCode = new Map();
    const existingBySku = new Map();
    const existingBySignature = new Map();
    const matchedExistingIds = new Set();
    existingVariants.forEach((variant) => {
        const code = String(variant?.variant_code || '').trim();
        const sku = String(variant?.sku || '').trim();
        const signature = (() => {
            const opts = variant?.options_values && typeof variant.options_values === 'object'
                ? variant.options_values
                : {};
            const entries = Object.entries(opts)
                .map(([k, v]) => [String(k || '').trim(), String(v || '').trim()])
                .filter(([k, v]) => k && v)
                .sort(([a], [b]) => a.localeCompare(b));
            if (entries.length === 0) return null;
            return `sig:${entries.map(([k, v]) => `${k}:${v}`).join('|')}`;
        })();

        appendLookup(existingByCode, code ? `code:${code}` : null, variant);
        appendLookup(existingBySku, sku ? `sku:${sku}` : null, variant);
        appendLookup(existingBySignature, signature, variant);
    });

    const merged = [];

    incomingVariants.forEach((incoming) => {
        let existing = null;

        const incomingCode = String(incoming?.variant_code || '').trim();
        if (incomingCode) {
            existing = pickUnmatchedVariant(existingByCode, `code:${incomingCode}`, matchedExistingIds);
        }

        const incomingSku = String(incoming?.sku || '').trim();
        if (!existing && incomingSku) {
            existing = pickUnmatchedVariant(existingBySku, `sku:${incomingSku}`, matchedExistingIds);
        }

        const incomingKey = buildVariantMatchKey(incoming);
        if (!existing && incomingKey?.startsWith('sig:')) {
            existing = pickUnmatchedVariant(existingBySignature, incomingKey, matchedExistingIds);
        }

        if (existing) {
            matchedExistingIds.add(existing.id);
            merged.push({
                ...incoming,
                id: existing.id,
            });
        } else {
            merged.push(incoming);
        }
    });

    existingVariants.forEach((variant) => {
        if (!matchedExistingIds.has(variant.id)) {
            merged.push(variant);
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
    const importMode = normalizeImportMode(body.import_mode);

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
        archivedVariants: 0,
        reactivatedVariants: 0,
        failedProducts: 0,
        conflicts: 0,
    };
    
    const errors = [];
    const conflicts = [];
    const updatedProductIds = new Set();
    
    for (const item of items) {
        let createdProductId = null;
        let rollbackProductId = null;
        let rollbackProductPayload = null;
        let productId = null;
        let productOperation = null;

        try {
            assertBatchItem(item);
            const spu = item.spu ? String(item.spu).trim() : null;
            let isNew = false;
            
            if (spu) {
                const existing = await repo.findBySpu(spu);
                if (existing) {
                    productId = existing.id;
                    productOperation = 'updated';
                    const updateData = { ...item };
                    delete updateData.variants;
                    let nextUpdateData = updateData;
                    if (importMode === IMPORT_MODE.SAFE_MERGE) {
                        nextUpdateData = buildSafeProductUpdateData(existing, updateData, conflicts);
                    }
                    if (Object.keys(nextUpdateData).length > 0) {
                        rollbackProductId = productId;
                        rollbackProductPayload = Object.keys(nextUpdateData).reduce((acc, field) => {
                            acc[field] = existing?.[field] ?? null;
                            return acc;
                        }, {});
                        const updateResult = await repo.updateWithMeta(productId, nextUpdateData);
                        if (updateResult?.success === false) {
                            throw new Error(updateResult.error || 'Update product failed');
                        }
                    }
                }
            }
            
            if (!productId) {
                const createData = { ...item };
                delete createData.variants;
                const newProduct = await repo.create(createData);
                productId = newProduct.id;
                createdProductId = productId;
                isNew = true;
                productOperation = 'created';
            }
            
            if (item.variants && item.variants.length > 0) {
                const existingVariants = isNew ? [] : await variantRepo.findByProductId(productId);
                const variantsToSync = mergeIncomingWithExisting(existingVariants, item.variants);
                const nextVariantsToSync = importMode === IMPORT_MODE.SAFE_MERGE
                    ? buildSafeVariantSyncPayload(existingVariants, variantsToSync, conflicts, item)
                    : variantsToSync;
                const existingIdSet = new Set(existingVariants.map((v) => v.id));
                const incomingVariantCount = Array.isArray(item.variants) ? item.variants.length : 0;
                const matchedUpdateCount = nextVariantsToSync.reduce((count, variant) => (
                    variant?.id && existingIdSet.has(variant.id) ? count + 1 : count
                ), 0);
                const computedUpdated = Math.min(incomingVariantCount, matchedUpdateCount);
                const computedCreated = Math.max(incomingVariantCount - computedUpdated, 0);

                const syncResult = await variantRepo.syncVariants(productId, nextVariantsToSync);
                summary.createdVariants += syncResult?.createdCount ?? computedCreated;
                summary.updatedVariants += syncResult?.updatedCount ?? computedUpdated;
                summary.archivedVariants += syncResult?.archivedCount ?? syncResult?.deletedCount ?? 0;
                summary.reactivatedVariants += syncResult?.reactivatedCount ?? 0;
            }

            if (productOperation === 'created') {
                summary.createdProducts++;
            } else if (productOperation === 'updated') {
                summary.updatedProducts++;
            }
            if (productId) {
                updatedProductIds.add(productId);
            }
        } catch (error) {
            if (createdProductId) {
                try {
                    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(createdProductId).run();
                } catch (rollbackError) {
                    console.error('Batch product rollback failed:', rollbackError);
                }
                if (productOperation === 'created') {
                    summary.createdProducts = Math.max(0, summary.createdProducts - 1);
                }
                updatedProductIds.delete(createdProductId);
            } else if (rollbackProductId && rollbackProductPayload) {
                try {
                    await repo.updateWithMeta(rollbackProductId, rollbackProductPayload);
                } catch (rollbackError) {
                    console.error('Batch product update rollback failed:', rollbackError);
                }
            }
            summary.failedProducts++;
            errors.push(`Failed to process item ${item.spu || item.name}: ${error.message}`);
        }
    }

    summary.conflicts = conflicts.length;
    const success = summary.createdProducts > 0 || summary.updatedProducts > 0;
    
    const result = {
        success,
        importMode,
        count: summary.createdProducts + summary.updatedProducts,
        summary,
        errors,
        conflicts: conflicts.slice(0, 200),
    };

    if (success) {
        scheduleProductCacheInvalidation(c, env.DB, {
            productIds: [...updatedProductIds],
        });
    }

    return c.json(result);
});

export default app;
