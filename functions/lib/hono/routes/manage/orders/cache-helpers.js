import { getSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import { invalidateCache } from '../../../middleware/cache.js';
import {
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
} from '../../_shared/cache-urls.js';

function normalizeSalespersonIds(ids = []) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === 'string' && id.trim());
}

export async function resolveSalesTokens(db, salespersonIds = []) {
  const normalizedIds = normalizeSalespersonIds(salespersonIds);
  return getSalespersonAccessTokens(db, normalizedIds);
}

export async function invalidateOrderNotificationCaches(c, { salesTokens = [] } = {}) {
  return invalidateCache(getOrderNotificationCacheUrls(c, { salesTokens }));
}

export async function invalidateOrderAndSalespersonCaches(c, { salesTokens = [] } = {}) {
  return invalidateCache(getOrderAndSalespersonCacheUrls(c, { salesTokens }));
}

export function scheduleOrderNotificationCacheInvalidation(c, { salesTokens = [] } = {}) {
  c.executionCtx.waitUntil(invalidateOrderNotificationCaches(c, { salesTokens }));
}

export function scheduleOrderAndSalespersonCacheInvalidation(c, { salesTokens = [] } = {}) {
  c.executionCtx.waitUntil(invalidateOrderAndSalespersonCaches(c, { salesTokens }));
}
