/**
 * DomainOutboxConsumers — 共享工具函数
 *
 * 被多个 consumer 复用的状态管理、缓存失效、事件分类等辅助逻辑。
 */
import { invalidateCache } from '../../lib/hono/middleware/cache.js';
import { getSalespersonAccessTokens, getAllSalespersonAccessTokens } from '../../lib/hono/_shared/route-helpers.js';
import { refreshReadModels } from './read-model-refresher.js';

// 重新导出 refreshReadModels 供其他模块使用
export { refreshReadModels };

// ─── 通用工具 ─────────────────────────────────────────────

export function createCacheContext(baseUrl, purchaseOrderId = null) {
  const url = purchaseOrderId
    ? `${baseUrl}/api/manage/purchase-orders/${purchaseOrderId}`
    : `${baseUrl}/api/manage/purchase-orders`;

  return {
    req: {
      url,
    },
  };
}

export function createBaseContext(baseUrl, path = '/api/manage/orders') {
  return {
    req: {
      url: `${baseUrl}${path}`,
    },
  };
}

export function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export function resolvePurchaseOrderId(event, payload) {
  return payload.purchase_order_id
    || payload.purchaseOrderId
    || payload.po_id
    || (event?.aggregate_type === 'purchase_order' ? event.aggregate_id : null)
    || null;
}

export function resolveOrderId(event, payload) {
  return payload.order_id || payload.orderId || (event?.aggregate_type === 'order' ? event.aggregate_id : null) || null;
}

export function resolveSalespersonId(payload) {
  return payload.salesperson_id || payload.salespersonId || null;
}

// ─── 事件分类 ─────────────────────────────────────────────

export function isOrderDomainEvent(eventType) {
  return String(eventType || '').startsWith('order_');
}

export function isOrderMutationEvent(eventType) {
  const normalized = String(eventType || '');
  return normalized.startsWith('order_')
    && !normalized.startsWith('order_procurement_')
    && normalized !== 'order_read_by_admin'
    && normalized !== 'order_read_by_sales';
}

export function isReminderDomainEvent(eventType) {
  return eventType === 'order_pending_reminder_due' || eventType === 'order_deadline_reminder_due';
}

export function shouldRefreshManageStatsProjection(eventType) {
  return [
    'file_uploaded',
    'folder_created',
    'folder_updated',
    'folder_deleted',
    'space_created',
    'space_updated',
    'space_deleted',
    'space_file_added',
    'space_file_removed',
    'space_file_reordered',
    'space_subspace_created',
    'v1_folder_created',
    'v1_folder_updated',
    'v1_folder_deleted',
    'v1_folder_share_updated',
    'v1_file_created',
    'v1_file_updated',
    'v1_file_deleted',
    'v1_file_batch_deleted',
    'v1_file_batch_moved',
  ].includes(eventType);
}

export function shouldRefreshDashboardProjection(eventType) {
  return [
    'order_created_by_admin',
    'order_created_by_sales',
    'order_updated_by_admin',
    'order_updated_by_sales',
    'order_deleted_by_admin',
    'order_status_changed_by_admin',
    'order_status_changed_by_sales',
  ].includes(eventType)
    || shouldRefreshManageStatsProjection(eventType);
}

// ─── Poller 共享状态管理 ──────────────────────────────────

export function createPollerState() {
  return {
    invalidatedUrls: new Set(),
    allSalesTokens: null,
    salesTokensById: new Map(),
    refreshedReadModels: new Set(),
    readModelRefreshes: new Map(),
    services: {},
  };
}

export function getPollerState(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  // 使用工厂函数初始化缺失的属性，避免每次调用都做 instanceof 检查
  const defaults = createPollerState();
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (state[key] === undefined || state[key] === null ||
        (defaultValue instanceof Set && !(state[key] instanceof Set)) ||
        (defaultValue instanceof Map && !(state[key] instanceof Map))) {
      state[key] = defaultValue;
    }
  }

  return state;
}

export function resetMemoizedSalespersonTokens(state) {
  const sharedState = getPollerState(state);
  if (!sharedState) {
    return;
  }

  sharedState.allSalesTokens = null;
  if (sharedState.salesTokensById instanceof Map) {
    sharedState.salesTokensById.clear();
  } else {
    sharedState.salesTokensById = new Map();
  }
}

export async function getMemoizedSalespersonAccessTokens(db, salespersonIds = [], state) {
  const sharedState = getPollerState(state);
  const ids = [...new Set((salespersonIds || []).filter(Boolean))].sort();
  if (ids.length === 0) {
    return [];
  }

  if (!sharedState) {
    return getSalespersonAccessTokens(db, ids);
  }

  const cacheKey = ids.join(',');
  if (sharedState.salesTokensById.has(cacheKey)) {
    return await sharedState.salesTokensById.get(cacheKey);
  }

  const tokensPromise = Promise.resolve(getSalespersonAccessTokens(db, ids))
    .then((tokens) => {
      sharedState.salesTokensById.set(cacheKey, tokens);
      return tokens;
    })
    .catch((error) => {
      sharedState.salesTokensById.delete(cacheKey);
      throw error;
    });

  sharedState.salesTokensById.set(cacheKey, tokensPromise);
  return await tokensPromise;
}

export async function getMemoizedAllSalespersonAccessTokens(db, state) {
  const sharedState = getPollerState(state);
  if (!sharedState) {
    return getAllSalespersonAccessTokens(db);
  }

  if (Array.isArray(sharedState.allSalesTokens)) {
    return sharedState.allSalesTokens;
  }
  if (sharedState.allSalesTokens) {
    return await sharedState.allSalesTokens;
  }

  const tokensPromise = Promise.resolve(getAllSalespersonAccessTokens(db))
    .then((tokens) => {
      sharedState.allSalesTokens = tokens;
      return tokens;
    })
    .catch((error) => {
      sharedState.allSalesTokens = null;
      throw error;
    });

  sharedState.allSalesTokens = tokensPromise;
  return await tokensPromise;
}

export async function invalidateCacheOnce(urls, state) {
  const sharedState = getPollerState(state);
  const uniqueUrls = [...new Set((urls || []).filter(Boolean))];
  if (!sharedState) {
    if (uniqueUrls.length > 0) {
      await invalidateCache(uniqueUrls);
    }
    return uniqueUrls;
  }

  const freshUrls = uniqueUrls.filter((url) => {
    if (sharedState.invalidatedUrls.has(url)) {
      return false;
    }
    sharedState.invalidatedUrls.add(url);
    return true;
  });

  if (freshUrls.length > 0) {
    await invalidateCache(freshUrls);
  }

  return freshUrls;
}
