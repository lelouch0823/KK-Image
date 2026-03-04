import { getSalespersonAccessTokens } from '../../../_shared/route-helpers.js';
import {
  invalidateOrderAndSalespersonCaches,
  invalidateOrderNotificationCaches,
  scheduleOrderAndSalespersonCacheInvalidation,
  scheduleOrderNotificationCacheInvalidation,
} from '../../_shared/order-cache-helpers.js';

function normalizeSalespersonIds(ids = []) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === 'string' && id.trim());
}

export async function resolveSalesTokens(db, salespersonIds = []) {
  const normalizedIds = normalizeSalespersonIds(salespersonIds);
  return getSalespersonAccessTokens(db, normalizedIds);
}

export function scheduleOrderMutationCachesInvalidation(c, { salesTokens = [] } = {}) {
  scheduleOrderNotificationCacheInvalidation(c, { salesTokens });
  scheduleOrderAndSalespersonCacheInvalidation(c, { salesTokens });
}

export {
  invalidateOrderNotificationCaches,
  invalidateOrderAndSalespersonCaches,
  scheduleOrderNotificationCacheInvalidation,
  scheduleOrderAndSalespersonCacheInvalidation,
};
