import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProductRepository } from '../../../../../../repositories/ProductRepository.js';
import { ProductDimensionRepository } from '../../../../../../repositories/ProductDimensionRepository.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../../_shared/audit-route-contract.js';
import { NotFoundError, BadRequestError } from '../../../../errors.js';
import {
  CreateDimensionSchema,
  UpdateDimensionSchema,
  ArchiveDimensionSchema,
  CreateDimensionValueSchema,
  DimensionImpactPreviewSchema,
} from '../../../../schemas/product.js';
import {
  buildRequestFingerprint,
  publishProductCacheEvent,
  runIdempotentCommand,
} from '../idempotency-helpers.js';

const app = new Hono();
const PRODUCT_DIMENSION_CREATE_COMMAND_TYPE = 'product_dimension_create';
const PRODUCT_DIMENSION_ARCHIVE_COMMAND_TYPE = 'product_dimension_archive';
const PRODUCT_DIMENSION_VALUE_CREATE_COMMAND_TYPE = 'product_dimension_value_create';
const PRODUCT_DIMENSION_VALUE_ARCHIVE_COMMAND_TYPE = 'product_dimension_value_archive';
const PRODUCT_DIMENSION_VALUE_RESTORE_COMMAND_TYPE = 'product_dimension_value_restore';

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/dimensions',
    domain: 'products',
    action: 'product.dimension.create',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/dimensions/:dimensionId',
    domain: 'products',
    action: 'product.dimension.update',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/dimensions/:dimensionId/archive',
    domain: 'products',
    action: 'product.dimension.archive',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'POST',
    path: '/:id/dimensions/:dimensionId/values',
    domain: 'products',
    action: 'product.dimension_value.create',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/values/:valueId/archive',
    domain: 'products',
    action: 'product.dimension_value.archive',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/values/:valueId/restore',
    domain: 'products',
    action: 'product.dimension_value.restore',
    severity: 'high',
    targetType: 'product',
  },
]);

const ensureProductExists = async (productRepo, productId) => {
  const product = await productRepo.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  return product;
};

function buildProductMutationRequestFingerprint(scope = {}) {
  return buildRequestFingerprint(scope);
}

app.post('/:id/dimensions', zValidator('json', CreateDimensionSchema), async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const body = c.req.valid('json');
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

app.patch('/:id/dimensions/:dimensionId', zValidator('json', UpdateDimensionSchema), async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const dimensionId = c.req.param('dimensionId');
  const body = c.req.valid('json');
  const requestFingerprint = buildProductMutationRequestFingerprint({
    productId,
    dimensionId,
    body,
  });
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

app.patch(
  '/:id/dimensions/:dimensionId/archive',
  zValidator('json', ArchiveDimensionSchema),
  async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = c.req.valid('json');
    const mode = String(body?.mode || 'archive_variants').trim();
    const requestFingerprint = buildProductMutationRequestFingerprint({
      productId,
      dimensionId,
      mode,
    });
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
          effect = {
            archivedVariants: await dimensionRepo.archiveVariantsByDimension(
              productId,
              dimensionId
            ),
          };
        }
        const archivedDimension = await dimensionRepo.archiveDimension(productId, dimensionId);

        // 刷新商品投影表
        const { ProductProjectionRefreshService } =
          await import('../../../../../../services/ProductProjectionRefreshService.js');
        const refreshService = new ProductProjectionRefreshService(env.DB);
        await refreshService.refreshByProductId(productId, c.executionCtx, { strict: true });

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
  }
);

app.post(
  '/:id/dimensions/:dimensionId/values',
  zValidator('json', CreateDimensionValueSchema),
  async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const dimensionId = c.req.param('dimensionId');
    const body = c.req.valid('json');
    const requestFingerprint = buildProductMutationRequestFingerprint({
      productId,
      dimensionId,
      body,
    });
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
  }
);

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

app.post('/:id/dimensions/impact', zValidator('json', DimensionImpactPreviewSchema), async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const body = c.req.valid('json');
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

export default app;
