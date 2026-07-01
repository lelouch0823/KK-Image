import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProductRepository } from '../../../../../../repositories/ProductRepository.js';
import { VariantImageRepository } from '../../../../../../repositories/VariantImageRepository.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../../_shared/audit-route-contract.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../../errors.js';
import { AddVariantImageSchema, SortVariantImagesSchema } from '../../../../schemas/product.js';
import {
  buildRequestFingerprint,
  publishProductCacheEvent,
  runIdempotentCommand,
} from '../idempotency-helpers.js';
import { parseBooleanFlag } from '../../../../../../ai/config-schema.js';

const app = new Hono();
const PRODUCT_VARIANT_IMAGE_CREATE_COMMAND_TYPE = 'product_variant_image_create';
const PRODUCT_VARIANT_IMAGE_SORT_COMMAND_TYPE = 'product_variant_image_sort';
const PRODUCT_VARIANT_IMAGE_PRIMARY_COMMAND_TYPE = 'product_variant_image_primary';
const PRODUCT_VARIANT_IMAGE_DELETE_COMMAND_TYPE = 'product_variant_image_delete';

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/variants/:variantId/images',
    domain: 'products',
    action: 'product.variant_image.create',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/variants/:variantId/images/sort',
    domain: 'products',
    action: 'product.variant_image.sort',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'PATCH',
    path: '/:id/variants/:variantId/images/:imageId/primary',
    domain: 'products',
    action: 'product.variant_image.primary',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'DELETE',
    path: '/:id/variants/:variantId/images/:imageId',
    domain: 'products',
    action: 'product.variant_image.delete',
    severity: 'high',
    targetType: 'product',
  },
]);

const isVariantOwnershipError = (error) =>
  error?.message?.includes('Variant does not belong to product');
const isVariantImageDuplicateError = (error) =>
  error?.message?.includes('Image already linked to variant');
const isVariantImageMissingError = (error) =>
  error?.message?.includes('Variant image does not exist');
const isVariantImageSortContractError = (error) =>
  error?.message?.includes('imageIds must include each variant image exactly once');

const rethrowVariantImageMutationError = (error) => {
  if (
    isVariantOwnershipError(error) ||
    isVariantImageMissingError(error) ||
    isVariantImageSortContractError(error)
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

function buildProductMutationRequestFingerprint(scope = {}) {
  return buildRequestFingerprint(scope);
}

app.post(
  '/:id/variants/:variantId/images',
  zValidator('json', AddVariantImageSchema),
  async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const body = c.req.valid('json');

    const requestFingerprint = buildProductMutationRequestFingerprint({
      productId,
      variantId,
      body,
    });
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
  }
);

app.patch(
  '/:id/variants/:variantId/images/sort',
  zValidator('json', SortVariantImagesSchema),
  async (c) => {
    const { env } = c;
    const productId = c.req.param('id');
    const variantId = c.req.param('variantId');
    const body = c.req.valid('json');

    const requestFingerprint = buildProductMutationRequestFingerprint({
      productId,
      variantId,
      imageIds: body.imageIds,
    });
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
  }
);

app.patch('/:id/variants/:variantId/images/:imageId/primary', async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const variantId = c.req.param('variantId');
  const imageId = c.req.param('imageId');
  const requestFingerprint = buildProductMutationRequestFingerprint({
    productId,
    variantId,
    imageId,
  });
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
  const requestFingerprint = buildProductMutationRequestFingerprint({
    productId,
    variantId,
    imageId,
  });
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

export default app;
