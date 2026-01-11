/**
 * AI 流式聊天 API (Admin Only)
 * POST /api/ai/stream
 * 
 * 返回 SSE 格式的流式响应，支持工具调用和增量文本输出。
 */
/* global ReadableStream */
import { MSG } from '../utils/messages.js';
import { TOOL_DESCRIPTIONS } from '../utils/ai-prompts.js';
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
            description: TOOL_DESCRIPTIONS.GET_ORDER_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getRecentPendingOrders",
            description: TOOL_DESCRIPTIONS.GET_RECENT_PENDING,
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "number", description: TOOL_DESCRIPTIONS.LIMIT_DESC }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getCustomerStats",
            description: TOOL_DESCRIPTIONS.GET_CUSTOMER_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getSpaceStats",
            description: TOOL_DESCRIPTIONS.GET_SPACE_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getSalespersonStats",
            description: TOOL_DESCRIPTIONS.GET_SALESPERSON_STATS,
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "getFileStats",
            description: TOOL_DESCRIPTIONS.GET_FILE_STATS,
            parameters: { type: "object", properties: {} }
        }
    }
];

export async function onRequestPost(context) {
    const { env, request } = context;
    const encoder = new TextEncoder();

    /**
     * SSE 事件发送辅助函数
     * @param {WritableStreamDefaultController} controller - 流控制器
     * @param {string} event - SSE 事件名称
     * @param {Object} data - 要发送的数据对象
     */
    const sendSSE = (controller, event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    try {
        // 1. 权限验证：确保只有管理员可以访问 AI 统计功能
        await authenticateAdmin(request, env);

        const { messages: history } = await request.json();

        // 2. 初始化核心逻辑库
        const orderStatsRepo = new OrderStatsRepository(env.DB);
        const systemStatsRepo = new SystemStatsRepository(env.DB);

        /**
         * 动态执行 AI 请求的工具函数
         * @param {string} name - 函数名称
         * @param {Object} args - 函数参数
         */
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

        // 3. 创建可读流以支持 SSE 推送
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let messages = [
                        { role: "system", content: SYSTEM_PROMPT },
                        ...history
                    ];

                    let aiStream;
                    let useStreaming = true;

                    // 4. 发起首轮 AI 调用 (尝试流式传输)
                    try {
                        aiStream = await callAIStream(messages, TOOLS, env);
                    } catch (_e) {
                        // 如果供应商或环境不支持流式，平滑降级为非流式模式
                        useStreaming = false;
                    }

                    if (useStreaming && aiStream) {
                        // === 流式处理模式 ===
                        const reader = aiStream.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let fullContent = '';
                        let toolCalls = [];

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });

                            // 健壮性优化：查找最后一个换行符，防止截断的 JSON 导致解析失败
                            const lastNewlineIndex = buffer.lastIndexOf('\n');
                            if (lastNewlineIndex !== -1) {
                                const toParse = buffer.slice(0, lastNewlineIndex + 1);
                                buffer = buffer.slice(lastNewlineIndex + 1);

                                const chunks = parseSSEChunk(toParse);
                                for (const chunk of chunks) {
                                    if (chunk.done) continue;

                                    const delta = chunk.choices?.[0]?.delta;
                                    if (!delta) continue;

                                    // 文本增量：实时推送给客户端渲染
                                    if (delta.content) {
                                        fullContent += delta.content;
                                        sendSSE(controller, 'text_delta', { content: delta.content });
                                    }

                                    // 工具调用增量：累积函数调用信息
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

                        // === 工具调用处理逻辑 ===
                        if (toolCalls.length > 0) {
                            for (const tc of toolCalls) {
                                if (!tc.name) continue;
                                // 通知客户端当前的工具执行状态
                                sendSSE(controller, 'tool_call', { name: tc.name, status: 'started' });

                                // 后端直接执行业务查询
                                const args = tc.arguments ? JSON.parse(tc.arguments) : {};
                                const result = await executeTool(tc.name, args);

                                sendSSE(controller, 'tool_result', {
                                    name: tc.name,
                                    summary: MSG.AI.TOOLS.RESULT_READY || '数据已获取'
                                });

                                // 将执行结果喂回 AI 以获取最后的解读建议
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

                            // 进行终番回复 (为了保证解读逻辑的严密性，此处使用非流式请求)
                            const finalResponse = await callAI(messages, [], env);
                            const finalContent = finalResponse.choices[0].message.content;

                            // 针对 Markdown 特色内容（如表格）的特殊处理
                            if (finalContent.includes('|') && finalContent.includes('---')) {
                                sendSSE(controller, 'content_block', { type: 'table', content: finalContent });
                            } else {
                                sendSSE(controller, 'text_delta', { content: finalContent });
                            }
                        }
                    } else {
                        // === 兼容降级模式 (非流式请求) ===
                        const response = await callAI(messages, TOOLS, env);
                        let choice = response.choices[0];

                        // 处理单次往返中的工具调用
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

                            const finalResponse = await callAI(messages, [], env);
                            choice = finalResponse.choices[0];
                        }

                        // 为了统一前端体验，将非流式的内容也模拟成流式分块发送
                        const content = choice.message.content;
                        if (content.includes('|') && content.includes('---')) {
                            sendSSE(controller, 'content_block', { type: 'table', content });
                        } else {
                            const chunkSize = 20;
                            for (let i = 0; i < content.length; i += chunkSize) {
                                sendSSE(controller, 'text_delta', { content: content.slice(i, i + chunkSize) });
                            }
                        }
                    }

                    // 发送结束标记
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
                'Content-Type': 'text/event-stream', // 指定为 SSE 流格式
                'Cache-Control': 'no-cache',        // 禁用缓存，确保实时性
                'Connection': 'keep-alive',        // 保持长连接
            }
        });

    } catch (err) {
        // 外部捕获与通用错误处理
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
