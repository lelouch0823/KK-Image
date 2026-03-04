import { invalidateCache } from '../../middleware/cache.js';
import {
  getManageOrderCacheUrls,
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
  getSalesOrderCacheUrls,
} from '../_shared/cache-urls.js';

export async function invalidateOrderNotificationCaches(c) {
  return invalidateCache(getOrderNotificationCacheUrls(c));
}

export async function invalidateOrderAndSalespersonCaches(c, { salesToken } = {}) {
  return invalidateCache(getOrderAndSalespersonCacheUrls(c, { salesTokens: [salesToken] }));
}

export async function invalidateSalesOrderListCaches(c, { salesToken } = {}) {
  return invalidateCache(getSalesOrderCacheUrls(c, { salesTokens: [salesToken] }));
}

export async function invalidateManageOrderCaches(c) {
  return invalidateCache(getManageOrderCacheUrls(c));
}

export function scheduleOrderNotificationCacheInvalidation(c) {
  c.executionCtx.waitUntil(invalidateOrderNotificationCaches(c));
}

export function scheduleOrderAndSalespersonCacheInvalidation(c, { salesToken } = {}) {
  c.executionCtx.waitUntil(invalidateOrderAndSalespersonCaches(c, { salesToken }));
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
