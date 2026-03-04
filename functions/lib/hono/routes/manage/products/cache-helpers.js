import { invalidateCache, getProductCacheUrls } from '../../../middleware/cache.js';
import { getAllSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import { getSalesProductCacheUrls } from '../../_shared/cache-urls.js';

export function scheduleProductCacheInvalidation(c, db, { productIds = [] } = {}) {
  const normalizedProductIds = [...new Set((productIds || []).filter(Boolean))];

  c.executionCtx.waitUntil((async () => {
    const salesTokens = await getAllSalespersonAccessTokens(db);
    const urls = new Set([
      ...getProductCacheUrls(c),
      ...getSalesProductCacheUrls(c, { salesTokens }),
    ]);

    for (const productId of normalizedProductIds) {
      for (const url of getSalesProductCacheUrls(c, { salesTokens, productId })) {
        urls.add(url);
      }
    }

    await invalidateCache([...urls]);
  })());
}
