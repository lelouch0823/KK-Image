import { Hono } from 'hono';
import {
    ProductCatalogService,
    buildVariantMatchKey,
    mergeIncomingWithExisting,
} from '../../../../../services/ProductCatalogService.js';

const app = new Hono();

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', async (c) => {
    const service = new ProductCatalogService(c.env.DB);
    const body = await c.req.json();
    const result = await service.batchImport(c, body);
    return c.json(result);
});

export { buildVariantMatchKey, mergeIncomingWithExisting };
export default app;
