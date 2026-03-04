import { invalidateCache } from '../../middleware/cache.js';
import {
  getManageOrderCacheUrls,
  getSalesOrderCacheUrls,
} from '../_shared/cache-urls.js';
import {
  invalidateOrderAndSalespersonCaches as invalidateOrderAndSalespersonCachesCore,
  invalidateOrderNotificationCaches as invalidateOrderNotificationCachesCore,
  scheduleOrderAndSalespersonCacheInvalidation as scheduleOrderAndSalespersonCacheInvalidationCore,
  scheduleOrderNotificationCacheInvalidation as scheduleOrderNotificationCacheInvalidationCore,
} from '../_shared/order-cache-helpers.js';

export async function invalidateOrderNotificationCaches(c) {
  return invalidateOrderNotificationCachesCore(c);
}

export async function invalidateOrderAndSalespersonCaches(c, { salesToken } = {}) {
  return invalidateOrderAndSalespersonCachesCore(c, { salesTokens: [salesToken] });
}

export async function invalidateSalesOrderListCaches(c, { salesToken } = {}) {
  return invalidateCache(getSalesOrderCacheUrls(c, { salesTokens: [salesToken] }));
}

export async function invalidateManageOrderCaches(c) {
  return invalidateCache(getManageOrderCacheUrls(c));
}

export function scheduleOrderNotificationCacheInvalidation(c) {
  scheduleOrderNotificationCacheInvalidationCore(c);
}

export function scheduleOrderAndSalespersonCacheInvalidation(c, { salesToken } = {}) {
  scheduleOrderAndSalespersonCacheInvalidationCore(c, { salesTokens: [salesToken] });
}

export function scheduleSalesOrderListCacheInvalidation(c, { salesToken } = {}) {
  c.executionCtx.waitUntil(invalidateSalesOrderListCaches(c, { salesToken }));
}

export function scheduleManageOrderCacheInvalidation(c) {
  c.executionCtx.waitUntil(invalidateManageOrderCaches(c));
}

export function scheduleSalesOrderMutationCachesInvalidation(c, { salesToken } = {}) {
  scheduleOrderAndSalespersonCacheInvalidation(c, { salesToken });
  scheduleOrderNotificationCacheInvalidation(c);
}

export function scheduleSalesCommentCachesInvalidation(c) {
  scheduleOrderNotificationCacheInvalidation(c);
  scheduleManageOrderCacheInvalidation(c);
}
