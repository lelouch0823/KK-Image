import { Hono } from 'hono';
import { OrderStatsRepository } from '../../../../repositories/OrderStatsRepository.js';
import { MSG, getChinaDayStart } from '../../_shared/utils.js';

const app = new Hono();

/**
 * GET /overview - 获取仪表盘概览数据
 */
app.get('/overview', async (c) => {
    const { env } = c;

    try {
        const statsRepo = new OrderStatsRepository(env.DB);
        const todayStartTimestamp = getChinaDayStart();

        // 计算本周和上周的时间范围
        const weekStartTimestamp = todayStartTimestamp - 6 * 24 * 60 * 60 * 1000;
        const lastWeekStartTimestamp = weekStartTimestamp - 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const [todayCount, pendingCount, recentPendingOrders, weekCount, lastWeekCount, activeSharesCount, todayHourlyTrend, pendingTrend, weekTrendData, shareTrend] = await Promise.all([
            statsRepo.countCreatedAfter(todayStartTimestamp),
            statsRepo.countByStatus('pending'),
            statsRepo.getRecentPending(20),
            statsRepo.countCreatedAfter(weekStartTimestamp),
            statsRepo.countCreatedBetween(lastWeekStartTimestamp, weekStartTimestamp),
            env.DB.prepare(`
        SELECT COUNT(*) as count FROM folders 
        WHERE is_public = 1 AND (share_expires_at IS NULL OR share_expires_at > ?)
      `).bind(now).first().then(r => r?.count || 0),
            statsRepo.getTodayHourlyTrend(todayStartTimestamp),
            statsRepo.getLast7DaysPendingTrend(weekStartTimestamp), // Using weekStartTimestamp (last 7 days)
            statsRepo.getLast7DaysOrderTrend(weekStartTimestamp),
            statsRepo.getLast7DaysShareTrend(weekStartTimestamp),
        ]);

        return c.json({
            success: true,
            data: {
                todayCount,
                pendingCount,
                recentPendingOrders,
                weekCount,
                lastWeekCount,
                activeSharesCount,
                charts: {
                    today: todayHourlyTrend, // Array of { hour: '00', count: 5 }
                    pending: pendingTrend,   // Array of { date: '2023-10-27', count: 10 }
                    week: weekTrendData,     // Array of { date: '2023-10-27', count: 50 }
                    shares: shareTrend       // Array of { date: '2023-10-27', count: 2 }
                }
            },
        });
    } catch (err) {
        console.error('Dashboard overview error:', err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

export default app;
