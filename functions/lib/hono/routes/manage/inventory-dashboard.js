/**
 * 库存预警看板 API (Inventory Dashboard)
 * =======================================
 *
 * 提供库存预警看板所需数据：摘要统计、低库存列表、零库存列表、
 * 最近库存变动、近 30 天出库排行。
 *
 * @module routes/manage/inventory-dashboard
 */

import { Hono } from 'hono';
import { InventoryDashboardRepository } from '../../../../repositories/InventoryDashboardRepository.js';
import { withCache } from '../../middleware/cache.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();
app.use('*', requirePermission('products:manage'));

/**
 * GET / — 库存预警看板聚合数据
 *
 * 返回:
 *   - summary: { totalSkus, lowStockCount, zeroStockCount, totalInventoryValue }
 *   - lowStockItems: 低库存变体列表
 *   - zeroStockItems: 零库存变体列表
 *   - recentMovements: 最近库存变动（最近 10 条）
 *   - topMovingItems: 近 30 天出库排行（top 10）
 */
app.get('/', withCache(20), async (c) => {
  const { env } = c;

  const repo = new InventoryDashboardRepository(env.DB);

  const [summary, lowStockItems, zeroStockItems, recentMovements, topMovingItems] =
    await Promise.all([
      repo.getSummary(),
      repo.getLowStockItems(50),
      repo.getZeroStockItems(50),
      repo.getRecentMovements(10),
      repo.getTopMovingItems(30, 10),
    ]);

  return c.json({
    success: true,
    data: {
      summary,
      lowStockItems,
      zeroStockItems,
      recentMovements,
      topMovingItems,
    },
  });
});

export default app;
