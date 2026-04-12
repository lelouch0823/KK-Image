import { Hono } from 'hono';
import {
    ProductCatalogService,
    buildVariantMatchKey,
    mergeIncomingWithExisting,
} from '../../../../../services/ProductCatalogService.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { buildRequestFingerprint, publishProductCacheEvent, runIdempotentCommand } from './idempotency-helpers.js';

const app = new Hono();
const PRODUCT_BATCH_IMPORT_COMMAND_TYPE = 'product_batch_import';
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'products', action: 'product.batch_import', severity: 'high', targetType: 'product' },
]);

function buildBatchImportRequestFingerprint(body = {}) {
    return buildRequestFingerprint(body);
}

async function publishBatchImportCacheEvent(c, result, { commandId, correlationId } = {}) {
    if (!result?.success) return;
    await publishProductCacheEvent(c, 'product_batch_imported', Array.isArray(result?.productIds) ? result.productIds : [], {
        commandId,
        correlationId,
    });
}

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', async (c) => {
    const service = new ProductCatalogService(c.env.DB);
    const body = await c.req.json();
    const requestFingerprint = buildBatchImportRequestFingerprint(body);
    return runIdempotentCommand(c, {
        commandType: PRODUCT_BATCH_IMPORT_COMMAND_TYPE,
        requestFingerprint,
        mismatchMessage: '同一个幂等键不能提交不同的批量导入请求',
        inFlightMessage: '当前幂等键对应的批量导入命令仍在处理中',
        execute: async () => service.batchImport(c, body, {
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

export { buildVariantMatchKey, mergeIncomingWithExisting };
export default app;
