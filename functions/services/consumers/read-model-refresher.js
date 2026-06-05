/**
 * 读模型刷新器
 * 封装统计投影和变体快照的刷新逻辑
 * @module services/consumers/read-model-refresher
 */

import { safeJsonParse } from '../../api/utils/json.js';
import {
  STATS_PROJECTION_SCOPES,
  SystemStatsProjectionRefreshService,
} from '../SystemStatsProjectionRefreshService.js';
import { VariantSnapshotProjectionRefreshService } from '../VariantSnapshotProjectionRefreshService.js';
import {
  shouldRefreshDashboardProjection,
  shouldRefreshManageStatsProjection,
} from './_shared.js';

/**
 * 获取变体快照刷新目标
 * @param {string} eventType
 * @param {Object} event
 * @param {Object} payload
 * @returns {string|null}
 */
function getVariantSnapshotRefreshTarget(eventType, event, payload) {
  if (eventType === 'order_created_by_admin' || eventType === 'order_created_by_sales') {
    return `variant:order:${event?.aggregate_id || payload?.order_id || ''}`;
  }
  if (['order_updated_by_admin', 'order_updated_by_sales', 'order_deleted_by_admin'].includes(eventType)) {
    return 'variant:all';
  }
  return null;
}

/**
 * 刷新读模型（统计投影、变体快照）
 * @param {Object} params
 * @param {D1Database} params.db
 * @param {Object} params.event
 * @param {Object} params.state
 */
export async function refreshReadModels({ db, event, state }) {
  if (!state || typeof state !== 'object') return;

  const eventType = String(event?.event_type || '');
  const refreshTargets = [];
  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );

  if (shouldRefreshManageStatsProjection(eventType)) {
    refreshTargets.push(`system:${STATS_PROJECTION_SCOPES.MANAGE_STATS}`);
  }
  if (shouldRefreshDashboardProjection(eventType)) {
    refreshTargets.push(`system:${STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW}`);
  }
  const variantSnapshotTarget = getVariantSnapshotRefreshTarget(eventType, event, payload);
  if (variantSnapshotTarget) {
    refreshTargets.push(variantSnapshotTarget);
  }

  // 初始化 state 属性
  if (!state.refreshedReadModels) state.refreshedReadModels = new Set();
  if (!state.readModelRefreshes) state.readModelRefreshes = new Map();
  if (!state.services) state.services = {};

  for (const target of refreshTargets) {
    if (state.refreshedReadModels.has(target)) continue;
    if (state.readModelRefreshes.has(target)) {
      await state.readModelRefreshes.get(target);
      continue;
    }

    const refreshPromise = (async () => {
      if (target.startsWith('system:')) {
        state.services.systemStats ||= new SystemStatsProjectionRefreshService(db);
        await state.services.systemStats.refresh(target.replace('system:', ''));
      } else if (target === 'variant:all') {
        state.services.variantSnapshot ||= new VariantSnapshotProjectionRefreshService(db);
        await state.services.variantSnapshot.refreshAll();
      } else if (target.startsWith('variant:order:')) {
        state.services.variantSnapshot ||= new VariantSnapshotProjectionRefreshService(db);
        await state.services.variantSnapshot.refreshByOrderId(target.replace('variant:order:', ''));
      }
      state.refreshedReadModels.add(target);
    })();

    state.readModelRefreshes.set(target, refreshPromise);
    try {
      await refreshPromise;
    } finally {
      state.readModelRefreshes.delete(target);
    }
  }
}
