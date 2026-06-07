import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  ProductCatalogService,
  buildVariantMatchKey,
  mergeIncomingWithExisting,
} from '../../../../../services/ProductCatalogService.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import {
  buildRequestFingerprint,
  publishProductCacheEvent,
  runIdempotentCommand,
} from './idempotency-helpers.js';
import { BatchImportProductSchema, BatchVariantStatusSchema } from '../../../schemas/product.js';

const app = new Hono();
const PRODUCT_BATCH_IMPORT_COMMAND_TYPE = 'product_batch_import';
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'products',
    action: 'product.batch_import',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'POST',
    path: '/status',
    domain: 'products',
    action: 'product.batch_status',
    severity: 'high',
    targetType: 'product',
  },
]);

function buildBatchImportRequestFingerprint(body = {}) {
  return buildRequestFingerprint(body);
}

async function publishBatchImportCacheEvent(c, result, { commandId, correlationId } = {}) {
  if (!result?.success) return;
  await publishProductCacheEvent(
    c,
    'product_batch_imported',
    Array.isArray(result?.productIds) ? result.productIds : [],
    {
      commandId,
      correlationId,
    }
  );
}

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', zValidator('json', BatchImportProductSchema), async (c) => {
  const service = new ProductCatalogService(c.env.DB);
  const body = c.req.valid('json');
  const requestFingerprint = buildBatchImportRequestFingerprint(body);
  return runIdempotentCommand(c, {
    commandType: PRODUCT_BATCH_IMPORT_COMMAND_TYPE,
    requestFingerprint,
    mismatchMessage: '同一个幂等键不能提交不同的批量导入请求',
    inFlightMessage: '当前幂等键对应的批量导入命令仍在处理中',
    execute: async () =>
      service.batchImport(c, body, {
        skipCacheInvalidation: true,
      }),
    publish: async ({ responseBody, reservation }) => {
      await publishBatchImportCacheEvent(c, responseBody, {
        commandId: reservation.record?.command_id,
        correlationId: reservation.record?.command_id,
      });
    },
    onSuccess: async (result) => {
      const summary = result?.summary || {};
      scheduleAuditEvent(c, {
        domain: 'products',
        action: 'product.batch_import',
        result: result?.success ? 'success' : 'failure',
        severity: 'high',
        targetType: 'product',
        summary: 'Batch imported products',
        metadata: {
          imported: result?.count ?? 0,
          created: summary.createdProducts ?? 0,
          updated: summary.updatedProducts ?? 0,
          failed: summary.failedProducts ?? 0,
          conflicts: summary.conflicts ?? 0,
        },
      });
    },
  });
});

/**
 * POST /batch/status - 批量变更商品规格状态 (上架/下架)
 * 请求体: { variantIds: string[], status: 'active' | 'archived' }
 */
app.post('/status', zValidator('json', BatchVariantStatusSchema), async (c) => {
  const { env } = c;
  const { variantIds, status } = c.req.valid('json');

  const now = Date.now();
  const placeholders = variantIds.map(() => '?').join(',');

  // 批量更新变体状态
  const statements = [];
  for (const variantId of variantIds) {
    statements.push(
      env.DB.prepare('UPDATE product_variants SET status = ?, updated_at = ? WHERE id = ?').bind(
        status,
        now,
        variantId
      )
    );
  }

  await env.DB.batch(statements);

  // 发布缓存事件
  await publishProductCacheEvent(c, `product_batch_${status}`, variantIds);

  const actionLabel = status === 'active' ? '上架' : '下架';
  scheduleAuditEvent(c, {
    domain: 'products',
    action: 'product.batch_status',
    result: 'success',
    severity: 'high',
    targetType: 'product',
    summary: `Batch ${actionLabel} ${variantIds.length} variants`,
    metadata: { count: variantIds.length, status },
  });

  return c.json({
    success: true,
    message: `成功${actionLabel} ${variantIds.length} 个商品规格`,
    data: { count: variantIds.length },
  });
});

export { buildVariantMatchKey, mergeIncomingWithExisting };
export default app;
