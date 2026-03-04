import { invalidateCache } from '../../middleware/cache.js';
import {
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
} from './cache-urls.js';

function resolveOrderNotificationCacheUrls(c, options) {
  if (!options || !Object.prototype.hasOwnProperty.call(options, 'salesTokens')) {
    return getOrderNotificationCacheUrls(c);
  }
  return getOrderNotificationCacheUrls(c, { salesTokens: options.salesTokens || [] });
}

function resolveOrderAndSalespersonCacheUrls(c, options) {
  if (!options || !Object.prototype.hasOwnProperty.call(options, 'salesTokens')) {
    return getOrderAndSalespersonCacheUrls(c);
  }
  return getOrderAndSalespersonCacheUrls(c, { salesTokens: options.salesTokens || [] });
}

export async function invalidateOrderNotificationCaches(c, options) {
  return invalidateCache(resolveOrderNotificationCacheUrls(c, options));
}

export async function invalidateOrderAndSalespersonCaches(c, options) {
  return invalidateCache(resolveOrderAndSalespersonCacheUrls(c, options));
}

export function scheduleOrderNotificationCacheInvalidation(c, options) {
  c.executionCtx.waitUntil(invalidateOrderNotificationCaches(c, options));
}

export function scheduleOrderAndSalespersonCacheInvalidation(c, options) {
  c.executionCtx.waitUntil(invalidateOrderAndSalespersonCaches(c, options));
}
