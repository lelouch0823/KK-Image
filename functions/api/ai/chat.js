/**
 * AI 聊天 API (Admin Only)
 * POST /api/ai/chat
 */
import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateAdmin } from '../../utils/auth.js';
import { OrderStatsRepository } from '../../../repositories/OrderStatsRepository.js';
import { callAI, SYSTEM_PROMPT } from '../../utils/ai-utils.js';
import { getChinaDayStart } from '../../utils/date.js';

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 1. 权限验证
        await authenticateAdmin(request, env);

        const { messages: history } = await request.json();

        // 2. 初始化 Repo
        const statsRepo = new OrderStatsRepository(env.DB);

        // 3. 定义工具列表
        const tools = [
            {
                type: "function",
                function: {
                    name: "getOrderStats",
                    description: "获取订单总体统计数据，包括今日、本周、本月订单数和待处理订单数。",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "getRecentPendingOrders",
                    description: "获取最近的待处理订单列表。",
                    parameters: {
                        type: "object",
                        properties: {
                            limit: { type: "number", description: "获取数量，默认为 5" }
                        }
                    }
                }
            }
        ];

        // 4. AI 交互循环 (处理 Function Calling)
        let messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history
        ];

        let response = await callAI(messages, tools, env);
        let choice = response.choices[0];

        // 如果 AI 想要调用工具
        if (choice.message.tool_calls) {
            messages.push(choice.message);

            for (const toolCall of choice.message.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let result = null;

                if (functionName === "getOrderStats") {
                    const todayStart = getChinaDayStart();
                    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
                    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;
                    result = await statsRepo.getAdminStats(todayStart, weekStart, monthStart);
                } else if (functionName === "getRecentPendingOrders") {
                    result = await statsRepo.getRecentPending(args.limit || 5);
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
        return error(`AI 助手暂时无法响应: ${err.message}`, 500);
    }
}
