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
import { shouldRefreshDashboardProjection, shouldRefreshManageStatsProjection } from './_shared.js';

/**
 * 获取变体快照刷新目标
 * @param {string} eventType
 * @param {Object} event
 * @param {Object} payload
 * @returns {string|null}
 */
function getVariantSnapshotRefreshTarget(eventType, event, payload) {
  const orderId = String(event?.aggregate_id || payload?.order_id || '');
  // 创建/更新：订单行仍然存在，按订单增量刷新其关联变体即可。
  // 此前更新走 variant:all —— 每次订单编辑都全表 DELETE+INSERT 重建投影，
  // 开销随 order_lines 总量线性增长，是热路径上最大的性能放大器之一
  if (
    ['order_created_by_admin', 'order_created_by_sales'].includes(eventType) ||
    eventType === 'order_updated_by_admin' ||
    eventType === 'order_updated_by_sales'
  ) {
    return orderId ? `variant:order:${orderId}` : null;
  }
  // 删除：级联删除后已无法从 order_lines 反查受影响变体，
  // 保留全量刷新以保证投影不残留已删订单的快照（低频管理操作）
  if (eventType === 'order_deleted_by_admin') {
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
