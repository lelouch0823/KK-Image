import { Hono } from 'hono';
import { OrderStatsRepository } from '../../../../repositories/OrderStatsRepository.js';
import { StatsRepository } from '../../../../repositories/StatsRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { getChinaDayStart, getFileUrl } from '../../_shared/utils.js';

const app = new Hono();

/**
 * GET /overview - 获取仪表盘概览数据 (SOTA: 聚合接口)
 */
app.get('/overview', async (c) => {
    const { env } = c;


        const statsRepo = new OrderStatsRepository(env.DB);
        const globalStatsRepo = new StatsRepository(env.DB);
        const folderRepo = new FolderRepository(env.DB);

        const todayStartTimestamp = getChinaDayStart();

        // 计算本周和上周的时间范围
        const weekStartTimestamp = todayStartTimestamp - 6 * 24 * 60 * 60 * 1000;
        const lastWeekStartTimestamp = weekStartTimestamp - 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const [
            todayCount,
            pendingCount,
            recentPendingOrders,
            weekCount,
            lastWeekCount,
            activeSharesCount,
            todayHourlyTrend,
            pendingTrend,
            weekTrendData,
            shareTrend,
            recentFiles,
            recentShares
        ] = await Promise.all([
            statsRepo.countCreatedAfter(todayStartTimestamp),
            statsRepo.countByStatus('pending'),
            statsRepo.getRecentPending(8),
            statsRepo.countCreatedAfter(weekStartTimestamp),
            statsRepo.countCreatedBetween(lastWeekStartTimestamp, weekStartTimestamp),
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM folders 
                WHERE is_public = 1 AND (share_expires_at IS NULL OR share_expires_at > ?)
            `).bind(now).first().then(r => r?.count || 0),
            statsRepo.getTodayHourlyTrend(todayStartTimestamp),
            statsRepo.getLast7DaysPendingTrend(weekStartTimestamp),
            statsRepo.getLast7DaysOrderTrend(weekStartTimestamp),
            statsRepo.getLast7DaysShareTrend(weekStartTimestamp),
            // SOTA: 在概览中直接包含最近文件和分享，减少 RTT
            globalStatsRepo.db.prepare(
                `SELECT id, name, size, mime_type as type, storage_key, created_at as timestamp 
                 FROM files ORDER BY created_at DESC LIMIT 5`
            ).all().then(r => r.results.map(f => ({
                ...f,
                url: getFileUrl(f.storage_key)
            }))),
            folderRepo.findShared({ limit: 5 }).then(r => r.items)
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
                    today: todayHourlyTrend,
                    pending: pendingTrend,
                    week: weekTrendData,
                    shares: shareTrend
                },
                recentFiles,
                recentShares
            },
        });

});

export default app;
