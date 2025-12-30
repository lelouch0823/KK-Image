/**
 * 管理端订单统计 API
 * GET /api/manage/orders/stats - 获取订单统计数据
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';

/**
 * GET - 获取订单统计
 */
export async function onRequestGet(context) {
    const { env } = context;

    try {
        const now = Date.now();
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000; // 7天前
        const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000; // 30天前

        // 并行查询统计数据
        const [
            todayResult,
            pendingResult,
            weekResult,
            statusResult,
            trendResult
        ] = await Promise.all([
            // 今日订单数
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM orders 
                WHERE created_at >= ?
            `).bind(todayStart).first(),

            // 待处理订单数
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM orders 
                WHERE status = 'pending'
            `).first(),

            // 本周订单数
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM orders 
                WHERE created_at >= ?
            `).bind(weekStart).first(),

            // 状态分布
            env.DB.prepare(`
                SELECT status, COUNT(*) as count FROM orders 
                GROUP BY status
            `).all(),

            // 近30天趋势
            env.DB.prepare(`
                SELECT 
                    DATE(created_at / 1000, 'unixepoch', 'localtime') as date,
                    COUNT(*) as count
                FROM orders 
                WHERE created_at >= ?
                GROUP BY DATE(created_at / 1000, 'unixepoch', 'localtime')
                ORDER BY date ASC
            `).bind(monthStart).all()
        ]);

        // 格式化状态分布
        const statusDistribution = {};
        statusResult.results.forEach(row => {
            statusDistribution[row.status] = row.count;
        });

        // 格式化趋势数据 (补全缺失日期)
        const trendMap = new Map();
        trendResult.results.forEach(row => {
            trendMap.set(row.date, row.count);
        });

        const monthTrend = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date(todayStart - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().slice(0, 10);
            monthTrend.push({
                date: dateStr,
                count: trendMap.get(dateStr) || 0
            });
        }

        return success({
            todayCount: todayResult.count,
            pendingCount: pendingResult.count,
            weekCount: weekResult.count,
            statusDistribution,
            monthTrend
        });

    } catch (err) {
        console.error('Order stats error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
