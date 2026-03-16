import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../repositories/VariantAuditRepository.js';
import { generateId } from '../api/utils/id.js';
import { resolveVariantImageSyncPlan } from '../lib/hono/routes/manage/products/variant-image-sync.js';
import { archiveVariantImagesByFolder } from '../lib/hono/routes/manage/products/variant-image-folders.js';
import { scheduleProductCacheInvalidation } from '../lib/hono/routes/manage/products/cache-helpers.js';
import { normalizeVariantDimensionKeys, normalizeVariantExternalCodes } from '../lib/hono/routes/manage/products/variant-normalizers.js';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/hono/errors.js';
import { validateProductPayload } from '../lib/hono/routes/manage/products/product-schema.js';
const IMPORT_MODE = {
    REPLACE: 'replace',
    SAFE_MERGE: 'safe_merge',
};

const PRODUCT_MUTABLE_FIELDS = new Set([
    'name', 'spu', 'slug', 'category', 'brand', 'series',
    'currency', 'description', 'images', 'specifications', 'options',
]);

const isVariantSyncValidationError = (error) => {
    const message = String(error?.message || '');
    return (
        message.includes('duplicate variant signature in payload') ||
        message.includes('variant signature must be unique per product')
    );
};

const hasOwnMeta = (value) =>
    value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'meta');

const normalizeMeta = (meta) => {
    if (meta === undefined || meta === null || meta === '') return null;
    return typeof meta === 'string' ? meta : JSON.stringify(meta);
};

function buildCatalogRollbackPayload(variants = []) {
    return (variants || []).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: Number(variant.price) || 0,
        cost_price: variant.cost_price !== undefined && variant.cost_price !== null
            ? Number(variant.cost_price)
            : null,
        alert_threshold: Number(variant.alert_threshold) || 10,
        options_values: variant.options_values || {},
        image_id: variant.image_id || null,
        status: variant.status || 'active',
        barcode: variant.barcode ?? null,
        supplier_sku: variant.supplier_sku ?? null,
    }));
}

function buildProductRollbackPayload(product = {}) {
    const rollback = {};
    for (const field of PRODUCT_MUTABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(product, field)) {
            rollback[field] = product[field];
        }
    }
    return rollback;
}

function assignGeneratedSkuForPatchVariants(variants = [], variantRepo) {
    return (variants || []).map((variant) => {
        if (String(variant?.sku || '').trim() || String(variant?.id || '').trim()) {
            return variant;
        }

        const fallbackSeed = variant._clientKey
            || variant.variant_code
            || JSON.stringify(variant.options_values || {})
            || generateId();
        const buildFallbackVariantSku = typeof variantRepo?.buildFallbackVariantSku === 'function'
            ? variantRepo.buildFallbackVariantSku.bind(variantRepo)
            : (value) => `SKU-${String(value || generateId()).replace(/[^a-zA-Z0-9]+/g, '').toUpperCase()}`;

        return {
            ...variant,
            sku: buildFallbackVariantSku(fallbackSeed),
        };
    });
}

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

export const normalizeImportMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === IMPORT_MODE.SAFE_MERGE) return IMPORT_MODE.SAFE_MERGE;
    return IMPORT_MODE.REPLACE;
};

export const assertBatchItem = (item) => {
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

export class ProductCatalogService {
    constructor(db) {
        this.db = db;
        this.productRepo = new ProductRepository(db);
        this.variantRepo = new ProductVariantRepository(db);
        this.dimensionRepo = new ProductDimensionRepository(db);
        this.auditRepo = new VariantAuditRepository(db);
    }

    async ensureProductExists(productId) {
        const product = await this.productRepo.findById(productId);
        if (!product) {
            throw new NotFoundError('Product not found');
        }
        return product;
    }

    async syncDimensionsFromPayload(productId, incomingDimensions = []) {
        if (!Array.isArray(incomingDimensions)) {
            return this.dimensionRepo.listByProduct(productId);
        }

        const existing = await this.dimensionRepo.listByProduct(productId);
        const existingById = new Map(existing.map((item) => [item.id, item]));

        for (let index = 0; index < incomingDimensions.length; index++) {
            const incoming = incomingDimensions[index] || {};
            const name = String(incoming.name || '').trim();
            if (!name) continue;

            let dimension = null;
            const incomingId = String(incoming.id || '').trim();
            if (incomingId && existingById.has(incomingId)) {
                dimension = await this.dimensionRepo.updateDimension(productId, incomingId, {
                    name,
                    sort_order: index,
                });
            } else {
                dimension = await this.dimensionRepo.createDimension(productId, {
                    name,
                    sort_order: index,
                });
            }

            const current = existingById.get(dimension.id) || { values: [] };
            const existingValuesMap = new Map((current.values || []).map((item) => [item.value, item]));
            const incomingVals = (incoming.values || [])
                .map((value) => (typeof value === 'string' ? { value } : value))
                .filter((value) => value.value);

            for (const item of incomingVals) {
                const valStr = String(item.value).trim();
                if (!valStr) continue;
                const shouldSyncMeta = hasOwnMeta(item);

                if (!existingValuesMap.has(valStr)) {
                    const payload = { value: valStr };
                    if (shouldSyncMeta) payload.meta = item.meta;
                    const createdValue = await this.dimensionRepo.addValue(productId, dimension.id, payload);
                    existingValuesMap.set(valStr, {
                        id: createdValue?.id,
                        value: valStr,
                        meta: shouldSyncMeta ? normalizeMeta(item.meta) : null,
                    });
                } else if (shouldSyncMeta) {
                    const existingRec = existingValuesMap.get(valStr);
                    const newMetaStr = normalizeMeta(item.meta);
                    const oldMetaStr = existingRec.meta || null;

                    if (newMetaStr !== oldMetaStr && existingRec.id) {
                        await this.dimensionRepo.updateValueMeta(productId, dimension.id, existingRec.id, item.meta);
                        existingRec.meta = newMetaStr;
                    }
                }
            }
        }

        return this.dimensionRepo.listByProduct(productId);
    }

    async cleanupCreatedCatalogRecords(created) {
        for (const variantId of created.variantIds) {
            await this.db.prepare('DELETE FROM variant_images WHERE variant_id = ?').bind(variantId).run();
            await this.db.prepare('DELETE FROM product_variants WHERE id = ?').bind(variantId).run();
        }

        for (const valueId of created.dimensionValueIds) {
            await this.db.prepare('DELETE FROM product_dimension_values WHERE id = ?').bind(valueId).run();
        }

        for (const dimensionId of created.dimensionIds) {
            await this.db.prepare('DELETE FROM product_dimensions WHERE id = ?').bind(dimensionId).run();
        }

        if (created.productId) {
            await this.db.prepare('DELETE FROM products WHERE id = ?').bind(created.productId).run();
        }
    }

    async createProduct(c, body) {
        if (!body.name) {
            throw new BadRequestError('Name is required');
        }

        body = validateProductPayload(body, { requireVariants: true });

        const normalizedSpu = typeof body.spu === 'string' ? body.spu.trim() : '';
        if (normalizedSpu) {
            body.spu = normalizedSpu;
            const existing = await this.productRepo.findBySpu(normalizedSpu);
            if (existing) {
                throw new ConflictError('SPU already exists');
            }
        }

        const created = {
            productId: null,
            dimensionIds: [],
            dimensionValueIds: [],
            variantIds: [],
        };

        let product = null;
        try {
            product = await this.productRepo.create(body);
            created.productId = product.id;

            const inputDimensions = Array.isArray(body.dimensions) ? body.dimensions : [];
            const createdDimensions = [];
            for (let i = 0; i < inputDimensions.length; i++) {
                const input = inputDimensions[i] || {};
                const dimension = await this.dimensionRepo.createDimension(product.id, {
                    name: input.name,
                    sort_order: Number.isInteger(input.sort_order) ? input.sort_order : i,
                });
                created.dimensionIds.push(dimension.id);
                createdDimensions.push(dimension);

                const values = Array.isArray(input.values) ? input.values : [];
                for (let j = 0; j < values.length; j++) {
                    const rawValue = values[j];
                    const value = typeof rawValue === 'string' ? rawValue : rawValue?.value;
                    if (!String(value || '').trim()) continue;

                    const payload = { value, sort_order: j };
                    if (rawValue && typeof rawValue === 'object' && Object.prototype.hasOwnProperty.call(rawValue, 'meta')) {
                        payload.meta = rawValue.meta;
                    }

                    const createdValue = await this.dimensionRepo.addValue(product.id, dimension.id, payload);
                    if (createdValue?.id) {
                        created.dimensionValueIds.push(createdValue.id);
                    }
                }
            }

            const normalizedVariants = normalizeVariantDimensionKeys(
                normalizeVariantExternalCodes(body.variants),
                createdDimensions
            );
            const createdVariants = await this.variantRepo.createBatch(product.id, normalizedVariants);
            created.variantIds.push(...createdVariants.map((variant) => variant.id).filter(Boolean));

            const variantImageRepo = new VariantImageRepository(this.db, this.variantRepo);
            const imageSyncPlan = resolveVariantImageSyncPlan({
                inputVariants: normalizedVariants,
                persistedVariants: createdVariants,
            });
            if (imageSyncPlan.unresolved.length > 0) {
                throw new BadRequestError(`Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`);
            }

            for (const task of imageSyncPlan.tasks) {
                await variantImageRepo.syncImages(product.id, task.variantId, task.images);
            }

            try {
                await archiveVariantImagesByFolder(c.env, product.id, imageSyncPlan.tasks);
            } catch (error) {
                console.error('Archive variant images by folder failed (product create):', error);
            }
        } catch (error) {
            await this.cleanupCreatedCatalogRecords(created);
            throw error;
        }

        scheduleProductCacheInvalidation(c, this.db, { productIds: [product?.id || null] });
        return product;
    }

    async patchProduct(c, productId, body) {
        const incomingDimensions = Array.isArray(body.dimensions) ? body.dimensions : null;
        const nextBody = { ...body };
        if (nextBody.dimensions !== undefined) delete nextBody.dimensions;

        Object.assign(nextBody, validateProductPayload(nextBody, {
            allowExistingVariantStockOmission: true,
            allowGeneratedVariantSku: true,
        }));

        if (nextBody.variants !== undefined) {
            const dimensions = incomingDimensions
                ? await this.syncDimensionsFromPayload(productId, incomingDimensions)
                : await this.dimensionRepo.listByProduct(productId);
            nextBody.variants = normalizeVariantDimensionKeys(
                assignGeneratedSkuForPatchVariants(
                    normalizeVariantExternalCodes(nextBody.variants),
                    this.variantRepo
                ),
                dimensions
            );
        }

        const hasProductFieldUpdates = Object.keys(nextBody).some((key) => PRODUCT_MUTABLE_FIELDS.has(key));
        if (!hasProductFieldUpdates) {
            await this.ensureProductExists(productId);
        }

        const result = hasProductFieldUpdates
            ? await this.productRepo.updateWithMeta(productId, nextBody)
            : { success: true, changes: 0 };

        let variantsUpdated = false;
        let variantSync = null;
        if (result.success && nextBody.variants !== undefined) {
            const beforeVariants = await this.variantRepo.findByProductId(productId);
            let didSyncVariants = false;

            try {
                try {
                    const syncResult = await this.variantRepo.syncVariants(productId, nextBody.variants);
                    didSyncVariants = true;
                    variantSync = {
                        created: syncResult?.createdCount ?? 0,
                        updated: syncResult?.updatedCount ?? 0,
                        archived: syncResult?.archivedCount ?? syncResult?.deletedCount ?? 0,
                        reactivated: syncResult?.reactivatedCount ?? 0,
                    };
                } catch (error) {
                    if (isVariantSyncValidationError(error)) {
                        throw new BadRequestError(error.message);
                    }
                    throw error;
                }

                const afterVariants = await this.variantRepo.findByProductId(productId);
                const variantImageRepo = new VariantImageRepository(this.db, this.variantRepo);
                const imageSyncPlan = resolveVariantImageSyncPlan({
                    inputVariants: nextBody.variants,
                    persistedVariants: afterVariants,
                });
                if (imageSyncPlan.unresolved.length > 0) {
                    throw new BadRequestError(
                        `Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`
                    );
                }

                for (const task of imageSyncPlan.tasks) {
                    await variantImageRepo.syncImages(productId, task.variantId, task.images);
                }

                try {
                    await archiveVariantImagesByFolder(c.env, productId, imageSyncPlan.tasks);
                } catch (error) {
                    console.error('Archive variant images by folder failed (product patch):', error);
                }

                const events = this.variantRepo.buildAuditEvents(productId, beforeVariants, afterVariants);
                await this.auditRepo.createBatch(events);
                variantsUpdated = true;
            } catch (error) {
                if (didSyncVariants) {
                    try {
                        await this.variantRepo.syncVariants(productId, buildCatalogRollbackPayload(beforeVariants));
                    } catch (rollbackError) {
                        console.error('Variant rollback failed (product patch):', rollbackError);
                    }
                }
                throw error;
            }
        }

        if ((result.success && result.changes > 0) || variantsUpdated) {
            scheduleProductCacheInvalidation(c, this.db, { productIds: [productId] });
            return {
                changes: result.changes,
                variantSync: variantSync || undefined,
                variantsUpdated,
            };
        }

        if (result.success && result.changes === 0) {
            return {
                changes: 0,
                variantSync: variantSync || undefined,
                variantsUpdated: false,
            };
        }

        throw new BadRequestError(result.error || 'Update failed');
    }

    async putProduct(c, productId, body) {
        return this.patchProduct(c, productId, body);
    }

    async batchImport(c, body = {}) {
        const items = body.items;
        const importMode = normalizeImportMode(body.import_mode);

        if (!Array.isArray(items) || items.length === 0) {
            throw new BadRequestError('Invalid items array');
        }

        if (items.length > 500) {
            throw new BadRequestError('Batch size limit exceeded (max 500)');
        }

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
            let productId = null;
            let productOperation = null;
            let existingProductSnapshot = null;
            let existingVariantsSnapshot = null;
            let existingDimensionsSnapshot = null;

            try {
                assertBatchItem(item);
                const normalizedItem = validateProductPayload({
                    ...item,
                    variants: normalizeVariantExternalCodes(item.variants),
                }, { requireVariants: true });
                const spu = normalizedItem.spu ? String(normalizedItem.spu).trim() : null;
                let isNew = false;

                if (spu) {
                    const existing = await this.productRepo.findBySpu(spu);
                    if (existing) {
                        productId = existing.id;
                        existingProductSnapshot = typeof this.productRepo.findById === 'function'
                            ? await this.productRepo.findById(productId)
                            : existing;
                        existingDimensionsSnapshot = await this.dimensionRepo.listByProduct(productId);
                        productOperation = 'updated';
                        const updateData = { ...normalizedItem };
                        delete updateData.variants;
                        delete updateData.dimensions;
                        const nextUpdateData = importMode === IMPORT_MODE.SAFE_MERGE
                            ? buildSafeProductUpdateData(existingProductSnapshot || existing, updateData, conflicts)
                            : updateData;
                        if (Object.keys(nextUpdateData).length > 0) {
                            const updateResult = await this.productRepo.updateWithMeta(productId, nextUpdateData);
                            if (updateResult?.success === false) {
                                throw new Error(updateResult.error || 'Update product failed');
                            }
                        }
                    }
                }

                if (!productId) {
                    const createData = { ...normalizedItem };
                    delete createData.variants;
                    delete createData.dimensions;
                    const newProduct = await this.productRepo.create(createData);
                    productId = newProduct.id;
                    createdProductId = productId;
                    isNew = true;
                    productOperation = 'created';
                }

                if (normalizedItem.variants && normalizedItem.variants.length > 0) {
                    const existingVariants = isNew ? [] : await this.variantRepo.findByProductId(productId);
                    existingVariantsSnapshot = existingVariants;
                    let normalizedVariants = normalizedItem.variants;
                    if (Array.isArray(normalizedItem.dimensions) && normalizedItem.dimensions.length > 0) {
                        const dimensions = await this.syncDimensionsFromPayload(productId, normalizedItem.dimensions);
                        normalizedVariants = normalizeVariantDimensionKeys(normalizedVariants, dimensions);
                    }
                    const variantsToSync = mergeIncomingWithExisting(existingVariants, normalizedVariants);
                    const nextVariantsToSync = importMode === IMPORT_MODE.SAFE_MERGE
                        ? buildSafeVariantSyncPayload(existingVariants, variantsToSync, conflicts, normalizedItem)
                        : variantsToSync;
                    const existingIdSet = new Set(existingVariants.map((variant) => variant.id));
                    const incomingVariantCount = Array.isArray(normalizedItem.variants) ? normalizedItem.variants.length : 0;
                    const matchedUpdateCount = nextVariantsToSync.reduce((count, variant) => (
                        variant?.id && existingIdSet.has(variant.id) ? count + 1 : count
                    ), 0);
                    const computedUpdated = Math.min(incomingVariantCount, matchedUpdateCount);
                    const computedCreated = Math.max(incomingVariantCount - computedUpdated, 0);

                    const syncResult = await this.variantRepo.syncVariants(productId, nextVariantsToSync);
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
                        await this.db.prepare('DELETE FROM products WHERE id = ?').bind(createdProductId).run();
                    } catch (rollbackError) {
                        console.error('Batch product rollback failed:', rollbackError);
                    }
                    if (productOperation === 'created') {
                        summary.createdProducts = Math.max(0, summary.createdProducts - 1);
                    }
                    updatedProductIds.delete(createdProductId);
                } else if (productOperation === 'updated' && productId) {
                    try {
                        if (existingProductSnapshot) {
                            const rollbackProductData = buildProductRollbackPayload(existingProductSnapshot);
                            if (Object.keys(rollbackProductData).length > 0) {
                                await this.productRepo.updateWithMeta(productId, rollbackProductData);
                            }
                        }
                        if (existingDimensionsSnapshot && typeof this.dimensionRepo.restoreSnapshot === 'function') {
                            await this.dimensionRepo.restoreSnapshot(productId, existingDimensionsSnapshot);
                        }
                        if (existingVariantsSnapshot) {
                            await this.variantRepo.syncVariants(productId, buildCatalogRollbackPayload(existingVariantsSnapshot));
                        }
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
            scheduleProductCacheInvalidation(c, this.db, {
                productIds: [...updatedProductIds],
            });
        }

        return result;
    }
}
