import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProductRepository } from '../../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../../repositories/VariantImageRepository.js';
import { VariantAuditRepository } from '../../../../../../repositories/VariantAuditRepository.js';
import { PriceRuleRepository } from '../../../../../../repositories/PriceRuleRepository.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../../_shared/audit-route-contract.js';
import { NotFoundError, BadRequestError } from '../../../../errors.js';
import { requirePermission } from '../../../../middleware/auth.js';
import { ProductCatalogService } from '../../../../../../services/ProductCatalogService.js';
import { loadVariantReplenishmentMap } from '../../../_shared/variant-replenishment.js';
import {
  buildRequestFingerprint,
  publishProductCacheEvent,
  reserveProductCommand,
  runIdempotentCommand,
} from '../idempotency-helpers.js';
import {
  cleanupReservedCommand,
  resolveReservationOwnership,
} from '../../../../../../services/order-procurement-shared.js';
import { UpdateProductSchema, UpdateProductStatusSchema } from '../../../../schemas/product.js';
import dimensionsApp from './dimensions.js';
import variantImagesApp from './variant-images.js';
import priceRulesApp from './price-rules.js';

const app = new Hono();
const PRODUCT_ARCHIVE_COMMAND_TYPE = 'product_archive';
const PRODUCT_UPDATE_COMMAND_TYPE = 'product_update';
const PRODUCT_REPLACE_COMMAND_TYPE = 'product_replace';

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'PATCH',
    path: '/:id',
    domain: 'products',
    action: 'product.update',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/status',
    domain: 'products',
    action: 'product.status.update',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PUT',
    path: '/:id',
    domain: 'products',
    action: 'product.replace',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'DELETE',
    path: '/:id',
    domain: 'products',
    action: 'product.archive',
    severity: 'critical',
    targetType: 'product',
  },
]);

app.use('*', requirePermission('products:manage'));

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

async function refreshProductProjectionStrict(c, productId) {
  const { ProductProjectionRefreshService } =
    await import('../../../../../../services/ProductProjectionRefreshService.js');
  const refreshService = new ProductProjectionRefreshService(c.env.DB);
  await refreshService.refreshByProductId(productId, c.executionCtx, { strict: true });
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
  const priceRuleRepo = new PriceRuleRepository(env.DB);
  const variants = await variantRepo.findByProductId(id);
  const replenishmentMap = await loadVariantReplenishmentMap(
    env.DB,
    variants.map((variant) => variant.id)
  );
  const dimensions = await dimensionRepo.listByProduct(id);
  const dimensionMap = await dimensionRepo.getDimensionMap(id);
  const priceRulesMap = await priceRuleRepo.findByProductId(id);
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
      const priceRules = priceRulesMap.get(variant.id) || [];
      return {
        ...variant,
        images,
        primaryImage: primary?.image_id || variant.image_id || null,
        replenishment_quantity: replenishment.replenishment_quantity,
        replenishment_po_count: replenishment.replenishment_po_count,
        price_rules: priceRules,
      };
    })
  );
  product.dimensions = dimensions;
  product.dimension_map = dimensionMap;

  return c.json({ success: true, data: product });
});

/**
 * PATCH /:id/status - 更新商品状态（生命周期管理）
 */
app.patch('/:id/status', zValidator('json', UpdateProductStatusSchema), async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const { status } = body;

  const repo = new ProductRepository(env.DB);
  const product = await ensureProductExists(repo, id);

  const previousStatus = product.status;
  if (previousStatus === status) {
    return c.json({ success: true, message: 'Status unchanged', data: { id, status } });
  }

  const result = await repo.updateStatus(id, status);
  if (!result.success) {
    throw new BadRequestError(result.error || 'Status update failed');
  }
  await refreshProductProjectionStrict(c, id);
  await publishProductCacheEvent(c, 'product_updated', [id]);

  scheduleAuditEvent(c, {
    domain: 'products',
    action: 'product.status.update',
    result: 'success',
    severity: 'high',
    targetType: 'product',
    targetId: id,
    target_label: product.name || id,
    summary: `Product status changed: ${previousStatus} -> ${status}`,
    metadata: { previousStatus, newStatus: status, productName: product.name },
  });

  return c.json({ success: true, message: 'Status updated', data: { id, status, previousStatus } });
});

/**
 * PATCH /:id - 更新商品 (Partial Update)
 */
app.patch('/:id', zValidator('json', UpdateProductSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
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
        metadata: {
          changeCount: Number.isFinite(Number(responseBody?.changes))
            ? Number(responseBody.changes)
            : undefined,
        },
      });
    },
  });
});

/**
 * PUT /:id - 更新商品 (Full Update)
 */
app.put('/:id', zValidator('json', UpdateProductSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
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
        metadata: {
          changeCount: Number.isFinite(Number(responseBody?.changes))
            ? Number(responseBody.changes)
            : undefined,
        },
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
  const { replay, resume, reservation, commandIdempotencyRepo } =
    await reserveProductArchiveCommand(c, { requestFingerprint });

  if (replay) {
    return c.json(getProductArchivePublicResponse(replay));
  }

  const repo = new ProductRepository(env.DB);
  await ensureProductExists(repo, id);
  const auditRepo = new VariantAuditRepository(env.DB);
  if (resume) {
    const storedArchive = normalizeProductArchiveStoredResponse(resume, id);
    if (
      !storedArchive?.variantAuditPersisted &&
      Array.isArray(storedArchive?.variantAuditEvents) &&
      storedArchive.variantAuditEvents.length > 0
    ) {
      await auditRepo.createBatch(storedArchive.variantAuditEvents);
      storedArchive.variantAuditPersisted = true;
    }
    await refreshProductProjectionStrict(c, storedArchive?.productId || id);
    await publishProductArchivedCacheEvent(c, storedArchive?.productId || id, {
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, storedArchive)
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
      metadata: {
        variantCount: Array.isArray(storedArchive?.variantAuditEvents)
          ? storedArchive.variantAuditEvents.length
          : 0,
      },
    });
    return c.json(getProductArchivePublicResponse(storedArchive));
  }

  const now = Date.now();
  const variantRepo = new ProductVariantRepository(env.DB);
  const ownsReservation = resolveReservationOwnership(reservation);
  let archiveState = null;

  try {
    const beforeVariants = await variantRepo.findByProductId(id);
    const result = await env.DB.prepare(
      `UPDATE product_variants SET status = 'archived', updated_at = ? WHERE product_id = ?`
    )
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

    // 刷新商品投影表，确保归档状态立即生效
    await refreshProductProjectionStrict(c, id);

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

// 挂载子路由
app.route('/', dimensionsApp);
app.route('/', variantImagesApp);
app.route('/', priceRulesApp);

export default app;
