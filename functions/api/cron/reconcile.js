/**
 * 定时任务：读模型投影对账（reconcile）
 * 触发方式：外部 Cron 服务调用 GET/POST /api/cron/reconcile（建议低频，如每日）
 * 鉴权：Header Authorization: Bearer <CRON_SECRET>
 *
 * 目的（审查 C-M7）：demand/snapshot/product 等投影全部是"事件驱动增量更新"，
 * 任何一次漏写都会永久漂移且无自愈入口。本任务按变体维度分批全量重算，
 * 作为最终一致性的兜底对账。分批处理避免单次运行超过 Workers CPU 限额。
 */

import { success, error } from '../utils/response.js';
import { isCronAuthorized } from '../utils/cron-auth.js';
import { D1_CHUNK_SIZE } from '../utils/constants.js';
import { chunkArray } from '../../lib/db/batch.js';
import { VariantDemandProjectionRefreshService } from '../../services/VariantDemandProjectionRefreshService.js';
import { VariantSnapshotProjectionRefreshService } from '../../services/VariantSnapshotProjectionRefreshService.js';
import { ProductProjectionRefreshService } from '../../services/ProductProjectionRefreshService.js';
import { SystemStatsProjectionRefreshService } from '../../services/SystemStatsProjectionRefreshService.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (!isCronAuthorized(request, env)) {
    return error('Unauthorized', 401);
  }

  try {
    const db = env.DB;

    // 1. 枚举全部变体 id（目录规模，分批）
    const { results: variantRows } = await db
      .prepare('SELECT id FROM product_variants WHERE status != ? ORDER BY id ASC')
      .bind('archived')
      .all();
    const variantIds = (variantRows || []).map((row) => row.id);

    const demandService = new VariantDemandProjectionRefreshService(db);
    const snapshotService = new VariantSnapshotProjectionRefreshService(db);
    const productProjectionService = new ProductProjectionRefreshService(db);

    let batches = 0;
    for (const chunk of chunkArray(variantIds, D1_CHUNK_SIZE)) {
      await demandService.refreshByVariantIds(chunk);
      await snapshotService.refreshByVariantIds(chunk);
      batches += 1;
    }

    // 2. 商品投影与系统统计全量重算
    await productProjectionService.refreshAll();
    const systemStats = new SystemStatsProjectionRefreshService(db);
    await systemStats.refreshManageStats();
    await systemStats.refreshDashboardOverview();

    return success(
      {
        variants: variantIds.length,
        batches,
        chunkSize: D1_CHUNK_SIZE,
      },
      'Projection reconcile completed'
    );
  } catch (err) {
    console.error('Cron reconcile failed:', err);
    return error(`Reconcile Failed: ${err.message}`, 500);
  }
}
