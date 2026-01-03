/**
 * 销售端统计 API
 * GET /api/sales/:token/stats - 获取个人统计数据
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';
import { OrderStatsRepository } from '../../../repositories/OrderStatsRepository.js';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { token } = params;

  try {
    // 鉴权
    const salesperson = await authenticateSalesperson(request, env, token);
    const statsRepo = new OrderStatsRepository(env.DB);

    // SOTA Date Logic
    const { getChinaDayStart, getChinaDateStr } = await import('../../utils/date.js');
    const todayStart = getChinaDayStart();
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000; // 30天前

    // 使用 Repository 获取统计
    const stats = await statsRepo.getSalesFullStats(salesperson.id, monthStart);

    // 格式化趋势数据 (补全缺失日期)
    const trendMap = new Map();
    stats.trend.forEach((row) => {
      trendMap.set(row.date, row.count);
    });

    const monthlyTrend = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = getChinaDateStr(todayStart - i * 24 * 60 * 60 * 1000);
      monthlyTrend.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0,
      });
    }

    return success({
      totalOrders: stats.total,
      completedOrders: stats.completed,
      monthOrders: stats.month,
      monthlyTrend,
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    console.error('Sales stats error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}
