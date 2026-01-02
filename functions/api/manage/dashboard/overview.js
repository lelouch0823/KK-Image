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
    // Correctly calculate "Start of Today" in UTC+8
    const now = new Date();
    // Get UTC timestamp
    const utcNow = now.getTime();
    // Offset for UTC+8
    const offset = 8 * 60 * 60 * 1000;
    // Local time in ms
    const localNow = utcNow + offset;
    // Local "Today 00:00:00" in ms
    const localTodayStart = Math.floor(localNow / 86400000) * 86400000;
    // Convert back to UTC timestamp for DB comparison
    const todayStartTimestamp = localTodayStart - offset;

    const [todayCount, pendingCount, recentPendingOrders] = await Promise.all([
      // 今日订单
      statsRepo.countCreatedAfter(todayStartTimestamp),
      // 待处理订单总数
      statsRepo.countByStatus('pending'),
      // 最近待处理订单 (Limit 5)
      statsRepo.getRecentPending(5),
    ]);

    return success({
      todayCount,
      pendingCount,
      recentPendingOrders,
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    console.error('Dashboard overview error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}
