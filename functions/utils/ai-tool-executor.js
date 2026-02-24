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
    const { orderStatsRepo, systemStatsRepo, orderRepo, orderTimelineRepo, productRepo, customerRepo, goodsOverviewRepo } = repos;

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

            // --- 具体业务数据搜索 ---
            case 'searchOrders': {
                const limit = args.limit ? Math.min(args.limit, 20) : 10;
                // 注意：由于 AI 没有登录上下文，我们在管理端搜索，无需 salespersonId
                const res = await orderRepo.listForAdmin({
                    search: args.search,
                    status: args.status,
                    limit: limit,
                    page: 1
                });
                return res.items;
            }
            case 'searchProducts': {
                const limit = args.limit ? Math.min(args.limit, 20) : 10;
                const res = await productRepo.search({
                    search: args.search,
                    category: args.category,
                    brand: args.brand,
                    status: args.status,
                    limit: limit,
                    page: 1
                });
                return res.items;
            }
            case 'searchCustomers': {
                const limit = args.limit ? Math.min(args.limit, 20) : 10;
                const res = await customerRepo.list({
                    search: args.search,
                    limit: limit,
                    page: 1
                });
                return res.results;
            }

            // --- 具体实体详情查询 ---
            case 'getOrderDetail': {
                if (!args.id) return { error: true, message: 'Missing order ID' };
                const dt = await orderRepo.findById(args.id);
                if (!dt) return { error: true, message: 'Order not found' };
                const timeline = await orderTimelineRepo.getTimeline(args.id);
                return { detail: dt, timeline: timeline.slice(0, 10) }; // 只返回最近10条日志防 token 超限
            }
            case 'getProductDetail': {
                if (!args.id) return { error: true, message: 'Missing product ID' };
                const dt = await productRepo.findById(args.id);
                return dt || { error: true, message: 'Product not found' };
            }
            case 'getCustomerDetail': {
                if (!args.id) return { error: true, message: 'Missing customer ID' };
                const dt = await customerRepo.findById(args.id);
                return dt || { error: true, message: 'Customer not found' };
            }

            // --- 订货总览 (Goods Overview) ---
            case 'getGoodsOverviewSummary': {
                return await goodsOverviewRepo.getSummary();
            }
            case 'getGoodsOverviewList': {
                const filters = {
                    category: args.category || '',
                    brand: args.brand || '',
                    shortageOnly: args.shortageOnly === true,
                    sort: args.sort || 'shortage'
                };
                const items = await goodsOverviewRepo.getList(filters);
                const limit = args.limit ? Math.min(args.limit, 20) : 10;
                return items.slice(0, limit);
            }

            default:
                console.warn(`[AI Tool] Unknown tool: ${name}`);
                return { error: true, message: `未知工具: ${name}` };
        }
    } catch (err) {
        console.error(`[AI Tool] Error executing ${name}:`, err.message);
        return { error: true, message: `工具执行失败: ${err.message}` };
    }
}
