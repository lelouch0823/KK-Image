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

    // 3. R15.2（发现 16）：库存余额对账 dry-run——inventory_balances.on_hand 的
    // 一致性完全依赖"同 batch 写入"纪律，目录直改/历史缺陷会让余额与台账
    // 永久背离且无自愈入口。按变体对比 Σ(影响 on_hand 的 ledger 事件) 与
    // 当前余额，只报告不修数（修复需人工确认每笔差异的归属）
    const inventoryDrift = await reconcileInventoryBalances(db);

    return success(
      {
        variants: variantIds.length,
        batches,
        chunkSize: D1_CHUNK_SIZE,
        inventoryDrift,
      },
      'Projection reconcile completed'
    );
  } catch (err) {
    console.error('Cron reconcile failed:', err);
    return error(`Reconcile Failed: ${err.message}`, 500);
  }
}

/**
 * 库存余额对账（只读）：Σ(inventory_ledger.quantity_delta) vs
 * inventory_balances.on_hand，按变体报告差异。
 * ledger 是 append-only 台账（所有写路径与余额同 batch 落账），理论上
 * Σ=on_hand 恒成立；漂移意味着存在绕过台账的写入（如修复前的目录直改），
 * 需要人工对账修复。
 */
async function reconcileInventoryBalances(db) {
  const { results: driftRows } = await db
    .prepare(
      `
      WITH ledger_totals AS (
        -- 预留 hold/release 只影响 reserved 不影响 on_hand，必须排除
        SELECT variant_id, COALESCE(SUM(quantity_delta), 0) AS ledger_sum
        FROM inventory_ledger
        WHERE variant_id IS NOT NULL
          AND event_type NOT IN ('reservation_hold', 'reservation_release')
        GROUP BY variant_id
      )
      SELECT
        COALESCE(ib.variant_id, lt.variant_id) AS variant_id,
        COALESCE(ib.on_hand, 0) AS balance_on_hand,
        COALESCE(lt.ledger_sum, 0) AS ledger_sum,
        COALESCE(ib.on_hand, 0) - COALESCE(lt.ledger_sum, 0) AS drift
      FROM inventory_balances ib
      FULL OUTER JOIN ledger_totals lt ON lt.variant_id = ib.variant_id
      WHERE COALESCE(ib.on_hand, 0) != COALESCE(lt.ledger_sum, 0)
      ORDER BY ABS(COALESCE(ib.on_hand, 0) - COALESCE(lt.ledger_sum, 0)) DESC
      LIMIT 100
    `
    )
    .all();

  const drifted = driftRows || [];
  if (drifted.length > 0) {
    console.warn(
      `[reconcile] inventory balance drift detected on ${drifted.length}+ variants ` +
        '(balance vs ledger sum); manual reconciliation required. Top items: ' +
        JSON.stringify(
          drifted.slice(0, 5).map((row) => ({
            variant_id: row.variant_id,
            balance: row.balance_on_hand,
            ledger: row.ledger_sum,
            drift: row.drift,
          }))
        )
    );
  }
  return { driftedCount: drifted.length, sample: drifted.slice(0, 5) };
}
