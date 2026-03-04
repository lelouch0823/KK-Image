import { getProductCacheUrls } from '../../../middleware/cache.js';
import { getSalesProductCacheUrls } from '../../_shared/cache-urls.js';
import { scheduleSalesTokenAwareCacheInvalidation } from '../../_shared/sales-token-cache-helpers.js';

export function scheduleProductCacheInvalidation(c, db, { productIds = [] } = {}) {
  const normalizedProductIds = [...new Set((productIds || []).filter(Boolean))];

  scheduleSalesTokenAwareCacheInvalidation(c, db, (salesTokens) => {
    const urls = new Set([
      ...getProductCacheUrls(c),
      ...getSalesProductCacheUrls(c, { salesTokens }),
    ]);

    for (const productId of normalizedProductIds) {
      for (const url of getSalesProductCacheUrls(c, { salesTokens, productId })) {
        urls.add(url);
      }
    }

    return [...urls];
  });
}
