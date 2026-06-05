/**
 * DomainOutboxConsumers — 缓存失效 consumer
 *
 * 根据领域事件类型解析需要失效的缓存 URL，执行缓存失效，
 * 并触发读模型（统计投影、变体快照）刷新。
 */
import { safeJsonParse } from '../../api/utils/json.js';
import {
  getManageStatsCacheUrls,
  getDashboardCacheUrls,
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
  getPurchaseOrderCacheUrls,
  getOrderAnalyticsCacheUrls,
} from '../../lib/hono/routes/_shared/cache-urls.js';
import {
  createBaseContext,
  createCacheContext,
  getMemoizedAllSalespersonAccessTokens,
  getMemoizedSalespersonAccessTokens,
  invalidateCacheOnce,
  isOrderMutationEvent,
  refreshReadModels,
  resetMemoizedSalespersonTokens,
  resolvePurchaseOrderId,
  resolveSalespersonId,
  shouldRefreshDashboardProjection,
  shouldRefreshManageStatsProjection,
} from './_shared.js';
import {
  isSalespersonCacheEvent,
  resolveOrderAffectedProductIds,
} from './_cache-helpers.js';
import {
  collectProductSurfaceCacheUrls,
  CACHE_URL_RESOLVERS,
} from './cache-url-resolvers.js';

// ─── 缓存 URL 解析 ───────────────────────────────────────

async function resolveExpandedCacheUrls({ db, event, baseUrl, payload, state }) {
  const ctx = createBaseContext(baseUrl);
  const eventType = event.event_type;

  for (const [match, resolve] of CACHE_URL_RESOLVERS) {
    if (match(eventType)) {
      return resolve({ db, ctx, event, baseUrl, payload, state });
    }
  }

  return [];
}

// ─── 主入口 ───────────────────────────────────────────────

export async function invalidateReceiptCaches({ db, event, baseUrl, state }) {
  if (!baseUrl) {
    console.warn('[cache-consumer] baseUrl is missing, skipping cache invalidation', { eventType: event?.event_type });
    return;
  }
  await refreshReadModels({ db, event, state });

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );

  if (isSalespersonCacheEvent(event?.event_type)) {
    resetMemoizedSalespersonTokens(state);
  }

  const projectionUrls = [];
  if (shouldRefreshManageStatsProjection(event?.event_type) || shouldRefreshDashboardProjection(event?.event_type)) {
    const projectionCtx = createBaseContext(baseUrl);
    if (shouldRefreshManageStatsProjection(event?.event_type)) {
      projectionUrls.push(...getManageStatsCacheUrls(projectionCtx));
    }
    if (shouldRefreshDashboardProjection(event?.event_type)) {
      projectionUrls.push(...getDashboardCacheUrls(projectionCtx));
    }
  }

  if (isOrderMutationEvent(event?.event_type)) {
    const ctx = createCacheContext(baseUrl);
    const salesTokens = await getMemoizedSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean), state);
    const allSalesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
    const affectedProductIds = await resolveOrderAffectedProductIds(db, event, payload);
    const urls = [
      ...getOrderAndSalespersonCacheUrls(ctx, { salesTokens }),
      ...getOrderNotificationCacheUrls(ctx, { salesTokens }),
      ...projectionUrls,
    ];

    for (const url of await collectProductSurfaceCacheUrls({
      db,
      ctx,
      salesTokens: allSalesTokens,
      productIds: affectedProductIds,
    })) {
      urls.push(url);
    }

    await invalidateCacheOnce([...new Set(urls)], state);
    return;
  }

  const expandedUrls = await resolveExpandedCacheUrls({ db, event, baseUrl, payload, state });
  if (expandedUrls.length > 0 || projectionUrls.length > 0) {
    await invalidateCacheOnce([...new Set([
      ...expandedUrls,
      ...projectionUrls,
    ])], state);
    return;
  }

  const purchaseOrderId = resolvePurchaseOrderId(event, payload);
  const ctx = createCacheContext(baseUrl, purchaseOrderId);
  const urls = [
    ...getPurchaseOrderCacheUrls(ctx, purchaseOrderId),
    ...getOrderAnalyticsCacheUrls(ctx),
    ...projectionUrls,
  ];

  await invalidateCacheOnce([...new Set(urls)], state);
}
