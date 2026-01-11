/**
 * AI 流式聊天 API (Admin Only)
 * POST /api/ai/stream
 * 
 * 返回 SSE 格式的流式响应，支持工具调用和增量文本输出。
 */
import { MSG } from '../utils/messages.js';
import { authenticateAdmin } from '../utils/auth.js';
import { OrderStatsRepository } from '../../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../../repositories/SystemStatsRepository.js';
import { callAIStream, callAI, parseSSEChunk, SYSTEM_PROMPT } from '../../utils/ai-utils.js';
import { DateUtils } from '../utils/date.js';

// SSE 工具定义
const TOOLS = [
    {
        type: "function",
        function: {
            name: "getOrderStats",
            description: MSG.AI.TOOLS.GET_ORDER_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getRecentPendingOrders",
            description: MSG.AI.TOOLS.GET_RECENT_PENDING,
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "number", description: MSG.AI.TOOLS.LIMIT_DESC }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getCustomerStats",
            description: MSG.AI.TOOLS.GET_CUSTOMER_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getSpaceStats",
            description: MSG.AI.TOOLS.GET_SPACE_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getSalespersonStats",
            description: MSG.AI.TOOLS.GET_SALESPERSON_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getFileStats",
            description: MSG.AI.TOOLS.GET_FILE_STATS,
            parameters: { type: "object", properties: {} }
        }
    }
];

export async function onRequestPost(context) {
    const { env, request } = context;
    const encoder = new TextEncoder();

    // SSE 辅助函数
    const sendSSE = (controller, event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    try {
        // 1. 权限验证
        await authenticateAdmin(request, env);

        const { messages: history } = await request.json();

        // 2. 初始化 Repos
        const orderStatsRepo = new OrderStatsRepository(env.DB);
        const systemStatsRepo = new SystemStatsRepository(env.DB);

        // 工具执行函数
        const executeTool = async (name, args) => {
            const todayStart = DateUtils.getChinaDayStart();
            const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
            const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

            switch (name) {
                case "getOrderStats":
                    return await orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart);
                case "getRecentPendingOrders":
                    return await orderStatsRepo.getRecentPending(args.limit || 5);
                case "getCustomerStats":
                    return await systemStatsRepo.getCustomerStats();
                case "getSpaceStats":
                    return await systemStatsRepo.getSpaceStats();
                case "getSalespersonStats":
                    return await systemStatsRepo.getSalespersonStats();
                case "getFileStats":
                    return await systemStatsRepo.getFileStats();
                default:
                    return null;
            }
        };

        // 3. 创建 SSE 流
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let messages = [
                        { role: "system", content: SYSTEM_PROMPT },
                        ...history
                    ];

                    // 第一次调用 AI (尝试流式)
                    let aiStream;
                    let useStreaming = true;

                    try {
                        aiStream = await callAIStream(messages, TOOLS, env);
                    } catch (_e) {
                        // 流式不支持，降级为非流式
                        useStreaming = false;
                    }

                    if (useStreaming && aiStream) {
                        // 流式处理
                        const reader = aiStream.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let fullContent = '';
                        let toolCalls = [];

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });

                            // 查找最后一个换行符，确保解析完整行
                            const lastNewlineIndex = buffer.lastIndexOf('\n');
                            if (lastNewlineIndex !== -1) {
                                const toParse = buffer.slice(0, lastNewlineIndex + 1);
                                buffer = buffer.slice(lastNewlineIndex + 1);

                                const chunks = parseSSEChunk(toParse);
                                for (const chunk of chunks) {
                                    if (chunk.done) continue;

                                    const delta = chunk.choices?.[0]?.delta;
                                    if (!delta) continue;

                                    // 增量文本
                                    if (delta.content) {
                                        fullContent += delta.content;
                                        sendSSE(controller, 'text_delta', { content: delta.content });
                                    }

                                    // 工具调用
                                    if (delta.tool_calls) {
                                        for (const tc of delta.tool_calls) {
                                            if (tc.index !== undefined) {
                                                if (!toolCalls[tc.index]) {
                                                    toolCalls[tc.index] = { id: '', name: '', arguments: '' };
                                                }
                                                if (tc.id) toolCalls[tc.index].id = tc.id;
                                                if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                                                if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 处理工具调用
                        if (toolCalls.length > 0) {
                            // 发送工具调用状态
                            for (const tc of toolCalls) {
                                if (!tc.name) continue;
                                sendSSE(controller, 'tool_call', { name: tc.name, status: 'started' });

                                // 执行工具
                                const args = tc.arguments ? JSON.parse(tc.arguments) : {};
                                const result = await executeTool(tc.name, args);

                                sendSSE(controller, 'tool_result', {
                                    name: tc.name,
                                    summary: MSG.AI.TOOLS.RESULT_READY || '数据已获取'
                                });

                                // 添加到消息历史
                                messages.push({
                                    role: 'assistant',
                                    content: fullContent || null,
                                    tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }]
                                });
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: tc.id,
                                    content: JSON.stringify(result)
                                });
                            }

                            // 再次调用 AI 获取最终回复 (非流式以确保完整性)
                            const finalResponse = await callAI(messages, [], env);
                            const finalContent = finalResponse.choices[0].message.content;

                            // 检测是否包含表格
                            if (finalContent.includes('|') && finalContent.includes('---')) {
                                sendSSE(controller, 'content_block', { type: 'table', content: finalContent });
                            } else {
                                sendSSE(controller, 'text_delta', { content: finalContent });
                            }
                        }
                    } else {
                        // 降级：非流式模式
                        const response = await callAI(messages, TOOLS, env);
                        let choice = response.choices[0];

                        // 处理工具调用
                        if (choice.message.tool_calls) {
                            messages.push(choice.message);

                            for (const toolCall of choice.message.tool_calls) {
                                const functionName = toolCall.function.name;
                                const args = JSON.parse(toolCall.function.arguments);

                                sendSSE(controller, 'tool_call', { name: functionName, status: 'started' });

                                const result = await executeTool(functionName, args);

                                sendSSE(controller, 'tool_result', { name: functionName, summary: '数据已获取' });

                                messages.push({
                                    tool_call_id: toolCall.id,
                                    role: "tool",
                                    name: functionName,
                                    content: JSON.stringify(result)
                                });
                            }

                            // 再次调用 AI
                            const finalResponse = await callAI(messages, [], env);
                            choice = finalResponse.choices[0];
                        }

                        // 模拟流式输出 (分块发送)
                        const content = choice.message.content;
                        if (content.includes('|') && content.includes('---')) {
                            sendSSE(controller, 'content_block', { type: 'table', content });
                        } else {
                            // 分块发送以模拟流式效果
                            const chunkSize = 20;
                            for (let i = 0; i < content.length; i += chunkSize) {
                                sendSSE(controller, 'text_delta', { content: content.slice(i, i + chunkSize) });
                            }
                        }
                    }

                    sendSSE(controller, 'done', {});
                } catch (err) {
                    sendSSE(controller, 'error', { message: err.message });
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return new Response(JSON.stringify({ success: false, message: err.message }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ success: false, message: `${MSG.AI.ERROR}: ${err.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
