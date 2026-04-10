import { Hono } from 'hono';
import {
    ProductCatalogService,
    buildVariantMatchKey,
    mergeIncomingWithExisting,
} from '../../../../../services/ProductCatalogService.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'products', action: 'product.batch_import', severity: 'high', targetType: 'product' },
]);

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', async (c) => {
    const service = new ProductCatalogService(c.env.DB);
    const body = await c.req.json();
    const result = await service.batchImport(c, body);
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
    return c.json(result);
});

export { buildVariantMatchKey, mergeIncomingWithExisting };
export default app;
