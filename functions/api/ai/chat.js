/**
 * AI 聊天 API (Admin Only)
 * POST /api/ai/chat
 */
import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';
import { AI_TOOLS } from '../utils/ai-prompts.js';
import { authenticateAdmin } from '../utils/auth.js';
import { OrderStatsRepository } from '../../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../../repositories/SystemStatsRepository.js';
import { callAI, SYSTEM_PROMPT } from '../../utils/ai-utils.js';
import { DateUtils } from '../utils/date.js';

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 1. 权限验证
        await authenticateAdmin(request, env);

        const { messages: history, context: clientContext = {} } = await request.json();

        // 2. 初始化 Repos
        const orderStatsRepo = new OrderStatsRepository(env.DB);
        const systemStatsRepo = new SystemStatsRepository(env.DB);

        // 3. AI 交互循环 (处理 Function Calling)
        const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const systemContent = SYSTEM_PROMPT(todayDate, clientContext);

        let messages = [
            { role: "system", content: systemContent },
            ...history
        ];

        let response = await callAI(messages, AI_TOOLS, env);
        let choice = response.choices[0];

        // 如果 AI 想要调用工具
        if (choice.message.tool_calls) {
            messages.push(choice.message);

            for (const toolCall of choice.message.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let result = null;

                // 订单相关
                if (functionName === "getOrderStats") {
                    const todayStart = DateUtils.getChinaDayStart();
                    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
                    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;
                    result = await orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart);
                } else if (functionName === "getRecentPendingOrders") {
                    result = await orderStatsRepo.getRecentPending(args.limit || 5);
                }
                // 客户统计
                else if (functionName === "getCustomerStats") {
                    result = await systemStatsRepo.getCustomerStats();
                }
                // 共享空间统计
                else if (functionName === "getSpaceStats") {
                    result = await systemStatsRepo.getSpaceStats();
                }
                // 销售人员统计
                else if (functionName === "getSalespersonStats") {
                    result = await systemStatsRepo.getSalespersonStats();
                }
                // 文件存储统计
                else if (functionName === "getFileStats") {
                    result = await systemStatsRepo.getFileStats();
                }

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(result)
                });
            }

            // 再次调用 AI 处理工具结果
            response = await callAI(messages, [], env);
        }

        return success({
            message: response.choices[0].message
        });

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('AI Chat Error:', err);
        return error(`${MSG.AI.ERROR}: ${err.message}`, 500);
    }
}
