/**
 * 管理端订单统计 API
 * GET /api/manage/orders/stats - 获取订单统计数据
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateAdmin } from '../../utils/auth.js';
import { OrderStatsRepository } from '../../../repositories/OrderStatsRepository.js';

/**
 * GET - 获取订单统计
 */
export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);
    const statsRepo = new OrderStatsRepository(env.DB);

    // SOTA Timezone handling: UTC+8
    const { getChinaDayStart } = await import('../../utils/date.js');
    const todayStart = getChinaDayStart();

    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000; // 7天前 (Inclusive of today)
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000; // 30天前

    // 使用 Repository 获取统计数据
    const stats = await statsRepo.getAdminStats(todayStart, weekStart, monthStart);

    // 补全趋势数据中缺失的日期
    const trendMap = new Map();
    stats.recentTrend.forEach((row) => {
      trendMap.set(row.date, row.count);
    });

    const { getChinaDateStr } = await import('../../utils/date.js');
    const monthTrend = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = getChinaDateStr(todayStart - i * 24 * 60 * 60 * 1000);
      monthTrend.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0,
      });
    }

    return success({
      todayCount: stats.today,
      pendingCount: stats.statusDistribution['pending'] || 0,
      weekCount: stats.week,
      statusDistribution: stats.statusDistribution,
      monthTrend,
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.EXPIRED) {
      return error(err.message, 401);
    }
    console.error('Order stats error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}
