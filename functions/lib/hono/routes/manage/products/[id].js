import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../../../../../repositories/VariantAuditRepository.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../errors.js';
import { requirePermission } from '../../../middleware/auth.js';
import { ProductCatalogService } from '../../../../../services/ProductCatalogService.js';
import { loadVariantReplenishmentMap } from '../../_shared/variant-replenishment.js';
import {
    buildRequestFingerprint,
    publishProductCacheEvent,
    reserveProductCommand,
    runIdempotentCommand,
} from './idempotency-helpers.js';
import {
    cleanupReservedCommand,
    parseStoredResponse,
    resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';

const app = new Hono();
const PRODUCT_ARCHIVE_COMMAND_TYPE = 'product_archive';
const PRODUCT_DIMENSION_CREATE_COMMAND_TYPE = 'product_dimension_create';
const PRODUCT_DIMENSION_ARCHIVE_COMMAND_TYPE = 'product_dimension_archive';
const PRODUCT_DIMENSION_VALUE_CREATE_COMMAND_TYPE = 'product_dimension_value_create';
const PRODUCT_DIMENSION_VALUE_ARCHIVE_COMMAND_TYPE = 'product_dimension_value_archive';
const PRODUCT_DIMENSION_VALUE_RESTORE_COMMAND_TYPE = 'product_dimension_value_restore';
const PRODUCT_VARIANT_IMAGE_CREATE_COMMAND_TYPE = 'product_variant_image_create';
const PRODUCT_VARIANT_IMAGE_SORT_COMMAND_TYPE = 'product_variant_image_sort';
const PRODUCT_VARIANT_IMAGE_PRIMARY_COMMAND_TYPE = 'product_variant_image_primary';
const PRODUCT_VARIANT_IMAGE_DELETE_COMMAND_TYPE = 'product_variant_image_delete';
const PRODUCT_UPDATE_COMMAND_TYPE = 'product_update';
const PRODUCT_REPLACE_COMMAND_TYPE = 'product_replace';
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/:id/dimensions', domain: 'products', action: 'product.dimension.create', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/dimensions/:dimensionId', domain: 'products', action: 'product.dimension.update', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/dimensions/:dimensionId/archive', domain: 'products', action: 'product.dimension.archive', severity: 'high', targetType: 'product' },
    { method: 'POST', path: '/:id/dimensions/:dimensionId/values', domain: 'products', action: 'product.dimension_value.create', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/values/:valueId/archive', domain: 'products', action: 'product.dimension_value.archive', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/values/:valueId/restore', domain: 'products', action: 'product.dimension_value.restore', severity: 'high', targetType: 'product' },
    { method: 'POST', path: '/:id/variants/:variantId/images', domain: 'products', action: 'product.variant_image.create', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/variants/:variantId/images/sort', domain: 'products', action: 'product.variant_image.sort', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id/variants/:variantId/images/:imageId/primary', domain: 'products', action: 'product.variant_image.primary', severity: 'high', targetType: 'product' },
    { method: 'DELETE', path: '/:id/variants/:variantId/images/:imageId', domain: 'products', action: 'product.variant_image.delete', severity: 'high', targetType: 'product' },
    { method: 'PATCH', path: '/:id', domain: 'products', action: 'product.update', severity: 'high', targetType: 'product' },
    { method: 'PUT', path: '/:id', domain: 'products', action: 'product.replace', severity: 'high', targetType: 'product' },
    { method: 'DELETE', path: '/:id', domain: 'products', action: 'product.archive', severity: 'critical', targetType: 'product' },
]);
app.use('*', requirePermission('products:manage'));

const isVariantOwnershipError = (error) =>
    error?.message?.includes('Variant does not belong to product');
const isVariantImageDuplicateError = (error) =>
    error?.message?.includes('Image already linked to variant');
const isVariantImageMissingError = (error) =>
    error?.message?.includes('Variant image does not exist');
const isVariantImageSortContractError = (error) =>
    error?.message?.includes('imageIds must include each variant image exactly once');
const parseBooleanFlag = (value) => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return value === true || value === 1;
};

const rethrowVariantImageMutationError = (error) => {
    if (
        isVariantOwnershipError(error)
        || isVariantImageMissingError(error)
        || isVariantImageSortContractError(error)
    ) {
        throw new BadRequestError(error.message);
    }
    if (isVariantImageDuplicateError(error)) {
        throw new ConflictError(error.message);
    }
    throw error;
};

const ensureProductExists = async (productRepo, productId) => {
    const product = await productRepo.findById(productId);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    return product;
};

function buildProductArchiveRequestFingerprint(productId) {
    return buildRequestFingerprint({
        productId: String(productId || '').trim(),
    });
}

function buildProductMutationRequestFingerprint(scope = {}) {
    return buildRequestFingerprint(scope);
}

async function publishProductArchivedCacheEvent(c, productId, { commandId, correlationId } = {}) {
    await publishProductCacheEvent(c, 'product_archived', [productId], { commandId, correlationId });
}

function buildProductArchiveStoredResponse({
    productId,
    response,
    variantAuditEvents = [],
    variantAuditPersisted = false,
}) {
    return {
        productId,
        response,
        variantAuditEvents,
        variantAuditPersisted: Boolean(variantAuditPersisted),
    };
}

function normalizeProductArchiveStoredResponse(storedResponse, productId) {
    if (!storedResponse) return null;
    if (storedResponse?.response) {
        return {
            productId: storedResponse.productId || productId,
            response: storedResponse.response,
            variantAuditEvents: Array.isArray(storedResponse.variantAuditEvents)
                ? storedResponse.variantAuditEvents
                : [],
            variantAuditPersisted: Boolean(storedResponse.variantAuditPersisted),
        };
    }

    return {
        productId,
        response: storedResponse,
        variantAuditEvents: [],
        variantAuditPersisted: true,
    };
}

function getProductArchivePublicResponse(storedResponse) {
    return storedResponse?.response || storedResponse;
}

async function reserveProductArchiveCommand(c, { requestFingerprint }) {
    return reserveProductCommand(c, {
        commandType: PRODUCT_ARCHIVE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品归档请求',
        inFlightMessage: '当前幂等键对应的商品归档命令仍在处理中',
    });
}

/**
 * GET /:id - 获取商品详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new ProductRepository(env.DB);
    const product = await ensureProductExists(repo, id);

    const variantRepo = new ProductVariantRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);
    const variantImageRepo = new VariantImageRepository(env.DB);
    const variants = await variantRepo.findByProductId(id);
    const replenishmentMap = await loadVariantReplenishmentMap(env.DB, variants.map((variant) => variant.id));
    const dimensions = await dimensionRepo.listByProduct(id);
    const dimensionMap = await dimensionRepo.getDimensionMap(id);
    product.variants = await Promise.all(
        variants.map(async (variant) => {
            const images = await variantImageRepo.listByVariant({
                productId: id,
                variantId: variant.id,
            });
            const primary = images.find((img) => Number(img.is_primary) === 1) || images[0] || null;
            const replenishment = replenishmentMap.get(variant.id) || {
                replenishment_quantity: 0,
                replenishment_po_count: 0,
            };
            return {
                ...variant,
                images,
                primaryImage: primary?.image_id || variant.image_id || null,
                replenishment_quantity: replenishment.replenishment_quantity,
                replenishment_po_count: replenishment.replenishment_po_count,
            };
        })
    );
    product.dimensions = dimensions;
    product.dimension_map = dimensionMap;

    return c.json({ success: true, data: product });
});

app.post('/:id/dimensions', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, body });
    const productRepo = new ProductRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_DIMENSION_CREATE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品规格维度创建请求',
        inFlightMessage: '当前幂等键对应的商品规格维度创建命令仍在处理中',
        successStatus: 201,
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const created = await dimensionRepo.createDimension(productId, body);
            return { success: true, data: created };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_dimension_created', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: async () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.dimension.create',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Created dimension on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BadRequestError(error.message || 'Create dimension failed');
        },
    });
});

app.patch('/:id/dimensions/:dimensionId', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = await c.req.json();
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, dimensionId, body });
    const productRepo = new ProductRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);
    return runIdempotentCommand(c, {
        commandType: 'product_dimension_update',
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品规格维度更新请求',
        inFlightMessage: '当前幂等键对应的商品规格维度更新命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const updated = await dimensionRepo.updateDimension(productId, dimensionId, body);
            return { success: true, data: updated };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_dimension_updated', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: async () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.dimension.update',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Updated dimension ${dimensionId} on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BadRequestError(error.message || 'Update dimension failed');
        },
    });
});

app.patch('/:id/dimensions/:dimensionId/archive', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = await c.req.json().catch(() => ({}));
    const mode = String(body?.mode || 'archive_variants').trim();
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, dimensionId, mode });
    const productRepo = new ProductRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_DIMENSION_ARCHIVE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品规格维度归档请求',
        inFlightMessage: '当前幂等键对应的商品规格维度归档命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            let effect = null;
            if (mode === 'merge_keep') {
                effect = await dimensionRepo.mergeKeepByDimensionRemoval(productId, dimensionId);
            } else {
                effect = { archivedVariants: await dimensionRepo.archiveVariantsByDimension(productId, dimensionId) };
            }
            const archivedDimension = await dimensionRepo.archiveDimension(productId, dimensionId);
            return { success: true, data: { dimension: archivedDimension, effect } };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_dimension_archived', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.dimension.archive',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Archived dimension ${dimensionId} on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BadRequestError(error.message || 'Archive dimension failed');
        },
    });
});

app.post('/:id/dimensions/:dimensionId/values', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = await c.req.json();
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, dimensionId, body });
    const productRepo = new ProductRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_DIMENSION_VALUE_CREATE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品规格值创建请求',
        inFlightMessage: '当前幂等键对应的商品规格值创建命令仍在处理中',
        successStatus: 201,
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const created = await dimensionRepo.addValue(productId, dimensionId, body);
            return { success: true, data: created };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_dimension_value_created', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: async () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.dimension_value.create',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Created dimension value on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BadRequestError(error.message || 'Add value failed');
        },
    });
});

app.patch('/:id/values/:valueId/archive', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const valueId = c.req.param('valueId');
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, valueId });
    const productRepo = new ProductRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_DIMENSION_VALUE_ARCHIVE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品规格值归档请求',
        inFlightMessage: '当前幂等键对应的商品规格值归档命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const effect = await dimensionRepo.archiveVariantsByValue(productId, valueId);
            const value = await dimensionRepo.archiveValue(productId, valueId);
            return { success: true, data: { value, effect } };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_dimension_value_archived', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.dimension_value.archive',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Archived dimension value ${valueId} on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BadRequestError(error.message || 'Archive value failed');
        },
    });
});

app.patch('/:id/values/:valueId/restore', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const valueId = c.req.param('valueId');
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, valueId });
    const productRepo = new ProductRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_DIMENSION_VALUE_RESTORE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品规格值恢复请求',
        inFlightMessage: '当前幂等键对应的商品规格值恢复命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const value = await dimensionRepo.restoreValue(productId, valueId);
            return { success: true, data: value };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_dimension_value_restored', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.dimension_value.restore',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Restored dimension value ${valueId} on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError || error instanceof BadRequestError) {
                throw error;
            }
            throw new BadRequestError(error.message || 'Restore value failed');
        },
    });
});

app.post('/:id/dimensions/impact', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const productRepo = new ProductRepository(env.DB);
    await ensureProductExists(productRepo, productId);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    try {
        const result = await dimensionRepo.getImpactPreview(productId, body);
        return c.json({ success: true, data: result });
    } catch (error) {
        throw new BadRequestError(error.message || 'Impact preview failed');
    }
});

app.post('/:id/variants/:variantId/images', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const body = await c.req.json();

    if (!body?.imageId) {
        throw new BadRequestError('imageId is required');
    }

    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, variantId, body });
    const productRepo = new ProductRepository(env.DB);
    const variantImageRepo = new VariantImageRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_VARIANT_IMAGE_CREATE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品变体图片创建请求',
        inFlightMessage: '当前幂等键对应的商品变体图片创建命令仍在处理中',
        successStatus: 201,
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const created = await variantImageRepo.addImage({
                productId,
                variantId,
                imageId: body.imageId,
                isPrimary: parseBooleanFlag(body.isPrimary),
            });
            return { success: true, data: created };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_variant_image_created', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: async () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.variant_image.create',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Added variant image to product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            rethrowVariantImageMutationError(error);
        },
    });
});

app.patch('/:id/variants/:variantId/images/sort', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const body = await c.req.json();

    if (!Array.isArray(body?.imageIds) || body.imageIds.length === 0) {
        throw new BadRequestError('imageIds must be a non-empty array');
    }

    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, variantId, imageIds: body.imageIds });
    const productRepo = new ProductRepository(env.DB);
    const variantImageRepo = new VariantImageRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_VARIANT_IMAGE_SORT_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品变体图片排序请求',
        inFlightMessage: '当前幂等键对应的商品变体图片排序命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            await variantImageRepo.sortImages({
                productId,
                variantId,
                imageIds: body.imageIds,
            });
            return { success: true };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_variant_image_sorted', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.variant_image.sort',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Sorted variant images on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            rethrowVariantImageMutationError(error);
        },
    });
});

app.patch('/:id/variants/:variantId/images/:imageId/primary', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const imageId = c.req.param('imageId');
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, variantId, imageId });
    const productRepo = new ProductRepository(env.DB);
    const variantImageRepo = new VariantImageRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_VARIANT_IMAGE_PRIMARY_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品变体主图设置请求',
        inFlightMessage: '当前幂等键对应的商品变体主图设置命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            await variantImageRepo.setPrimary({
                productId,
                variantId,
                imageId,
            });
            return { success: true };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_variant_image_primary_changed', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.variant_image.primary',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Changed primary variant image on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            rethrowVariantImageMutationError(error);
        },
    });
});

app.delete('/:id/variants/:variantId/images/:imageId', async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const imageId = c.req.param('imageId');
    const requestFingerprint = buildProductMutationRequestFingerprint({ productId, variantId, imageId });
    const productRepo = new ProductRepository(env.DB);
    const variantImageRepo = new VariantImageRepository(env.DB);

    return runIdempotentCommand(c, {
        commandType: PRODUCT_VARIANT_IMAGE_DELETE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品变体图片删除请求',
        inFlightMessage: '当前幂等键对应的商品变体图片删除命令仍在处理中',
        execute: async () => {
            await ensureProductExists(productRepo, productId);
            const removed = await variantImageRepo.deleteImage({
                productId,
                variantId,
                imageId,
            });
            if (!removed) {
                throw new NotFoundError('Variant image not found');
            }
            return { success: true };
        },
        publish: async ({ reservation }) => {
            await publishProductCacheEvent(c, 'product_variant_image_deleted', [productId], {
                commandId: reservation.record?.command_id,
                correlationId: reservation.record?.command_id,
            });
        },
        onSuccess: () => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.variant_image.delete',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: productId,
                target_label: productId,
                summary: `Deleted variant image on product ${productId}`,
            });
        },
        mapDomainError: (error) => {
            if (error instanceof NotFoundError) {
                throw error;
            }
            rethrowVariantImageMutationError(error);
        },
    });
});

/**
 * PATCH /:id - 更新商品 (Partial Update)
 */
app.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const service = new ProductCatalogService(c.env.DB);
    const requestFingerprint = buildProductMutationRequestFingerprint({
        productId: id,
        body,
        fullReplace: false,
    });

    return runIdempotentCommand(c, {
        commandType: PRODUCT_UPDATE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品更新请求',
        inFlightMessage: '当前幂等键对应的商品更新命令仍在处理中',
        execute: async ({ reservation }) => {
            const result = await service.patchProduct(c, id, body, {
                skipCacheInvalidation: true,
                cacheEventCommandId: reservation.record?.command_id,
                cacheEventCorrelationId: reservation.record?.command_id,
            });
            return {
                success: true,
                message: 'Product updated',
                changes: result.changes,
                variantSync: result.variantSync,
            };
        },
        publish: async ({ responseBody, reservation }) => {
            if (Number(responseBody?.changes || 0) > 0 || responseBody?.variantSync) {
                await publishProductCacheEvent(c, 'product_updated', [id], {
                    commandId: reservation.record?.command_id,
                    correlationId: reservation.record?.command_id,
                });
            }
        },
        onSuccess: async (responseBody) => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.update',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: id,
                target_label: id,
                summary: `Updated product ${id}`,
                metadata: { changeCount: Number.isFinite(Number(responseBody?.changes)) ? Number(responseBody.changes) : undefined },
            });
        },
    });
});

/**
 * PUT /:id - 更新商品 (Full Update)
 */
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const service = new ProductCatalogService(c.env.DB);
    const requestFingerprint = buildProductMutationRequestFingerprint({
        productId: id,
        body,
        fullReplace: true,
    });

    return runIdempotentCommand(c, {
        commandType: PRODUCT_REPLACE_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的商品替换请求',
        inFlightMessage: '当前幂等键对应的商品替换命令仍在处理中',
        execute: async ({ reservation }) => {
            const result = await service.putProduct(c, id, body, {
                skipCacheInvalidation: true,
                cacheEventCommandId: reservation.record?.command_id,
                cacheEventCorrelationId: reservation.record?.command_id,
            });
            return {
                success: true,
                message: 'Product updated',
                changes: result.changes,
                variantSync: result.variantSync,
            };
        },
        publish: async ({ responseBody, reservation }) => {
            if (Number(responseBody?.changes || 0) > 0 || responseBody?.variantSync) {
                await publishProductCacheEvent(c, 'product_replaced', [id], {
                    commandId: reservation.record?.command_id,
                    correlationId: reservation.record?.command_id,
                });
            }
        },
        onSuccess: async (responseBody) => {
            scheduleAuditEvent(c, {
                domain: 'products',
                action: 'product.replace',
                result: 'success',
                severity: 'high',
                targetType: 'product',
                targetId: id,
                target_label: id,
                summary: `Replaced product ${id}`,
                metadata: { changeCount: Number.isFinite(Number(responseBody?.changes)) ? Number(responseBody.changes) : undefined },
            });
        },
    });
});

/**
 * DELETE /:id - 删除商品 (Soft delete)
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const requestFingerprint = buildProductArchiveRequestFingerprint(id);
    const {
        replay,
        resume,
        reservation,
        commandIdempotencyRepo,
    } = await reserveProductArchiveCommand(c, { requestFingerprint });

    if (replay) {
        return c.json(getProductArchivePublicResponse(replay));
    }

    const repo = new ProductRepository(env.DB);
    await ensureProductExists(repo, id);
    const auditRepo = new VariantAuditRepository(env.DB);
    if (resume) {
        const storedArchive = normalizeProductArchiveStoredResponse(resume, id);
        if (!storedArchive?.variantAuditPersisted && Array.isArray(storedArchive?.variantAuditEvents) && storedArchive.variantAuditEvents.length > 0) {
            await auditRepo.createBatch(storedArchive.variantAuditEvents);
            storedArchive.variantAuditPersisted = true;
        }
        await publishProductArchivedCacheEvent(c, storedArchive?.productId || id, {
            commandId: reservation.record?.command_id,
            correlationId: reservation.record?.command_id,
        });
        await commandIdempotencyRepo
            .buildFinalizeStatement(reservation.record?.command_id, storedArchive)
            .run();
        return c.json(getProductArchivePublicResponse(storedArchive));
    }

    const now = Date.now();
    const variantRepo = new ProductVariantRepository(env.DB);
    const ownsReservation = resolveReservationOwnership(reservation);
    let archiveState = null;

    try {
        const beforeVariants = await variantRepo.findByProductId(id);
        const result = await env.DB
            .prepare(`UPDATE product_variants SET status = 'archived', updated_at = ? WHERE product_id = ?`)
            .bind(now, id)
            .run();
        const changedRows = Number(result?.meta?.changes || 0);
        const hadVariants = Array.isArray(beforeVariants) && beforeVariants.length > 0;
        const success = changedRows > 0 || !hadVariants;

        if (!success) {
            throw new BadRequestError('Delete failed');
        }

        const events = (beforeVariants || []).map((variant) => ({
            variant_id: variant.id,
            product_id: id,
            action: 'variant_archived',
            changes: { before: { status: variant.status || 'active' }, after: { status: 'archived' } },
        }));
        archiveState = buildProductArchiveStoredResponse({
            productId: id,
            response: { success: true, message: 'Product variants archived' },
            variantAuditEvents: events,
            variantAuditPersisted: false,
        });

        if (events.length > 0) {
            await auditRepo.createBatch(events);
            archiveState.variantAuditPersisted = true;
        }

        await publishProductArchivedCacheEvent(c, id, {
            commandId: reservation.record?.command_id,
            correlationId: reservation.record?.command_id,
        });
        await commandIdempotencyRepo
            .buildFinalizeStatement(reservation.record?.command_id, archiveState)
            .run();

        scheduleAuditEvent(c, {
            domain: 'products',
            action: 'product.archive',
            result: 'success',
            severity: 'critical',
            targetType: 'product',
            targetId: id,
            target_label: id,
            summary: `Archived product ${id}`,
            metadata: { variantCount: events.length },
        });
        return c.json(archiveState.response);
    } catch (error) {
        if (archiveState) {
            try {
                await commandIdempotencyRepo
                    .buildFinalizeStatement(reservation.record?.command_id, archiveState, 'failed')
                    .run();
            } catch (finalizeError) {
                console.error('Product archive idempotency finalize failed:', finalizeError);
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
});

export default app;
