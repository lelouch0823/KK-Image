import { getManageSpaceCacheUrls, getSalesSpaceCacheUrls } from '../../_shared/cache-urls.js';
import { scheduleSalesTokenAwareCacheInvalidation } from '../../_shared/sales-token-cache-helpers.js';

export function invalidateSpaceCaches(c, options = {}) {
  scheduleSalesTokenAwareCacheInvalidation(c, c.env.DB, (salesTokens) => [
      ...getManageSpaceCacheUrls(c, options),
      ...getSalesSpaceCacheUrls(c, { salesTokens, spaceId: options.spaceId }),
    ]);
}
