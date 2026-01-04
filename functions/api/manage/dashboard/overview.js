/**
 * 管理端仪表盘概览 API
 * GET /api/manage/dashboard/overview
 */
import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateAdmin } from '../../utils/auth.js';

import { OrderStatsRepository } from '../../../repositories/OrderStatsRepository.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);

    // Init Repo
    const statsRepo = new OrderStatsRepository(env.DB);

    // SOTA Timezone handling: Default to UTC+8 (China Standard Time)
    const { getChinaDayStart } = await import('../../utils/date.js');
    const todayStartTimestamp = getChinaDayStart();

    // 计算本周和上周的时间范围
    const weekStartTimestamp = todayStartTimestamp - 6 * 24 * 60 * 60 * 1000; // 7天前 (含今天)
    const lastWeekStartTimestamp = weekStartTimestamp - 7 * 24 * 60 * 60 * 1000; // 上周同期
    const now = Date.now();

    const [todayCount, pendingCount, recentPendingOrders, weekCount, lastWeekCount, activeSharesCount] = await Promise.all([
      // 今日订单
      statsRepo.countCreatedAfter(todayStartTimestamp),
      // 待处理订单总数
      statsRepo.countByStatus('pending'),
      // 最近待处理订单 (Limit 5)
      statsRepo.getRecentPending(5),
      // 本周订单
      statsRepo.countCreatedAfter(weekStartTimestamp),
      // 上周订单 (用于环比)
      statsRepo.countCreatedBetween(lastWeekStartTimestamp, weekStartTimestamp),
      // 活跃分享数 (未过期的公开分享)
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM folders 
        WHERE is_public = 1 AND (share_expires_at IS NULL OR share_expires_at > ?)
      `).bind(now).first().then(r => r?.count || 0),
    ]);

    return success({
      todayCount,
      pendingCount,
      recentPendingOrders,
      weekCount,
      lastWeekCount,
      activeSharesCount,
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    console.error('Dashboard overview error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}
