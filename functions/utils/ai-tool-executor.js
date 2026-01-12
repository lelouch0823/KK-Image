/**
 * AI 工具执行器
 * 统一管理 stream.js 和 chat.js 中的工具调用逻辑
 */
import { DateUtils } from '../api/utils/date.js';

/**
 * 执行 AI 工具调用
 * @param {string} name - 工具名称
 * @param {Object} args - 工具参数
 * @param {Object} repos - 仓库实例集合 { orderStatsRepo, systemStatsRepo }
 * @returns {Promise<any>} 工具执行结果
 */
export async function executeAITool(name, args, repos) {
    const { orderStatsRepo, systemStatsRepo } = repos;

    try {
        switch (name) {
            // --- 订单统计 ---
            case 'getOrderStats': {
                const todayStart = DateUtils.getChinaDayStart();
                const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
                const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;
                return await orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart);
            }
            case 'getRecentPendingOrders':
                return await orderStatsRepo.getRecentPending(args.limit || 5);

            // --- 客户统计 ---
            case 'getCustomerStats':
                return await systemStatsRepo.getCustomerStats();

            // --- 共享空间 ---
            case 'getSpaceStats':
                return await systemStatsRepo.getSpaceStats();

            // --- 销售人员 ---
            case 'getSalespersonStats':
                return await systemStatsRepo.getSalespersonStats();

            // --- 文件存储 ---
            case 'getFileStats':
                return await systemStatsRepo.getFileStats();

            default:
                console.warn(`[AI Tool] Unknown tool: ${name}`);
                return { error: true, message: `未知工具: ${name}` };
        }
    } catch (err) {
        console.error(`[AI Tool] Error executing ${name}:`, err.message);
        return { error: true, message: `工具执行失败: ${err.message}` };
    }
}
