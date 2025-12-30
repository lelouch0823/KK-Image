/**
 * 销售端统计 API
 * GET /api/sales/:token/stats - 获取个人统计数据
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { token } = params;

    try {
        // 鉴权
        const salesperson = await authenticateSalesperson(request, env, token);

        const now = Date.now();
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000; // 30天前

        // 并行查询
        const [
            totalResult,
            completedResult,
            monthResult,
            trendResult
        ] = await Promise.all([
            // 累计订单
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ?
            `).bind(salesperson.id).first(),

            // 已完成订单 (已交付)
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND status = 'delivered'
            `).bind(salesperson.id).first(),

            // 本月订单
            env.DB.prepare(`
                SELECT COUNT(*) as count FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
            `).bind(salesperson.id, monthStart).first(),

            // 近30天趋势
            env.DB.prepare(`
                SELECT 
                    DATE(created_at / 1000, 'unixepoch', 'localtime') as date,
                    COUNT(*) as count
                FROM orders 
                WHERE salesperson_id = ? AND created_at >= ?
                GROUP BY DATE(created_at / 1000, 'unixepoch', 'localtime')
                ORDER BY date ASC
            `).bind(salesperson.id, monthStart).all()
        ]);

        // 格式化趋势数据
        const trendMap = new Map();
        trendResult.results.forEach(row => {
            trendMap.set(row.date, row.count);
        });

        const monthlyTrend = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date(todayStart - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().slice(0, 10);
            monthlyTrend.push({
                date: dateStr,
                count: trendMap.get(dateStr) || 0
            });
        }

        return success({
            totalOrders: totalResult.count,
            completedOrders: completedResult.count,
            monthOrders: monthResult.count,
            monthlyTrend
        });

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Sales stats error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
