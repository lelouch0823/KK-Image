import { getAllSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { getManageSpaceCacheUrls, getSalesSpaceCacheUrls } from '../../_shared/cache-urls.js';

export function invalidateSpaceCaches(c, options = {}) {
  c.executionCtx.waitUntil((async () => {
    const salesTokens = await getAllSalespersonAccessTokens(c.env.DB);
    const urls = [
      ...getManageSpaceCacheUrls(c, options),
      ...getSalesSpaceCacheUrls(c, { salesTokens, spaceId: options.spaceId }),
    ];
    await invalidateCache([...new Set(urls)]);
  })());
}
