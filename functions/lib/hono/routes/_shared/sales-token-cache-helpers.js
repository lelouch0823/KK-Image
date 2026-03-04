import { getAllSalespersonAccessTokens } from '../../_shared/route-helpers.js';
import { invalidateCache } from '../../middleware/cache.js';

export function scheduleSalesTokenAwareCacheInvalidation(c, db, buildUrls) {
  c.executionCtx.waitUntil((async () => {
    const salesTokens = await getAllSalespersonAccessTokens(db);
    const urls = buildUrls(salesTokens);
    await invalidateCache([...new Set((urls || []).filter(Boolean))]);
  })());
}
