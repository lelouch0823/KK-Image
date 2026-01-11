/**
 * AI 流式聊天 API (Admin Only)
 * POST /api/ai/stream
 * 
 * 返回 SSE 格式的流式响应，支持工具调用和增量文本输出。
 */
/* global ReadableStream */
import { MSG } from '../utils/messages.js';
import { AI_TOOLS } from '../utils/ai-prompts.js';
import { authenticateAdmin } from '../utils/auth.js';
import { OrderStatsRepository } from '../../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../../repositories/SystemStatsRepository.js';
import { callAIStream, callAI, parseSSEChunk, SYSTEM_PROMPT } from '../../utils/ai-utils.js';
import { DateUtils } from '../utils/date.js';

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

        const { messages: history, context: clientContext = {} } = await request.json();

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
                    const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
                    const systemContent = SYSTEM_PROMPT(todayDate, clientContext);

                    let messages = [
                        { role: "system", content: systemContent },
                        ...history
                    ];

                    let aiStream;
                    let useStreaming = true;
                    let currentModel = null;
                    let modelSwitched = false;

                    // 4. 发起首轮 AI 调用 (尝试流式传输)
                    try {
                        console.log('[AI Stream] Calling callAIStream...');
                        const streamResult = await callAIStream(messages, AI_TOOLS, env);
                        console.log('[AI Stream] callAIStream returned:', {
                            hasBody: !!streamResult.body,
                            model: streamResult.model,
                            switched: streamResult.switched
                        });
                        aiStream = streamResult.body;
                        currentModel = streamResult.model;
                        modelSwitched = streamResult.switched;

                        // 如果发生了模型切换，通知前端
                        if (modelSwitched) {
                            sendSSE(controller, 'model_switch', {
                                model: currentModel,
                                reason: 'rate_limit'
                            });
                        }
                    } catch (streamError) {
                        // 如果供应商或环境不支持流式，平滑降级为非流式模式
                        console.error('[AI Stream] callAIStream failed:', streamError.message);
                        useStreaming = false;
                    }

                    if (useStreaming && aiStream) {
                        // === 流式处理模式 ===
                        const reader = aiStream.getReader();
                        const decoder = new TextDecoder();
                        let buffer = ''; // Raw byte buffer for decoding
                        let streamBuffer = ''; // Text buffer for parsing charts
                        let fullContent = '';
                        let toolCalls = [];

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                console.log('[AI Stream] Reader done');
                                break;
                            }

                            const decodedChunk = decoder.decode(value, { stream: true });
                            console.log(`[AI Stream] Received chunk (${value.length} bytes):`, decodedChunk.slice(0, 100) + (decodedChunk.length > 100 ? '...' : ''));
                            buffer += decodedChunk;

                            // 健壮性优化：查找最后一个换行符，防止截断的 JSON 导致解析失败
                            const lastNewlineIndex = buffer.lastIndexOf('\n');
                            if (lastNewlineIndex !== -1) {
                                const toParse = buffer.slice(0, lastNewlineIndex + 1);
                                buffer = buffer.slice(lastNewlineIndex + 1);

                                const chunks = parseSSEChunk(toParse);
                                console.log(`[AI Stream] Parsed ${chunks.length} SSE chunks`);
                                for (const chunk of chunks) {
                                    if (chunk.done) continue;

                                    const delta = chunk.choices?.[0]?.delta;
                                    if (!delta) {
                                        console.log('[AI Stream] Chunk has no delta:', JSON.stringify(chunk).slice(0, 100));
                                        continue;
                                    }

                                    // === 核心逻辑修改：文本与图表混合解析 ===
                                    if (delta.content) {
                                        fullContent += delta.content;
                                        streamBuffer += delta.content;

                                        // 循环处理 buffer，直到没有完整的图表或无法确定是否为文本
                                        while (true) {
                                            const chartStartIndex = streamBuffer.indexOf(':::chart');

                                            if (chartStartIndex === -1) {
                                                // 没找到开头，检查是否可能是开头的一部分 (Last few chars match partial ':::chart')
                                                // 最长可能是 ":::chart" (8 chars)
                                                let partialMatch = false;
                                                const checkLen = Math.min(streamBuffer.length, 8);
                                                for (let i = 1; i <= checkLen; i++) {
                                                    const suffix = streamBuffer.slice(-i);
                                                    if (":::chart".startsWith(suffix)) {
                                                        partialMatch = true;
                                                        // 发送 pending 的部分 (除去 suffix)
                                                        const safeText = streamBuffer.slice(0, -i);
                                                        if (safeText) {
                                                            sendSSE(controller, 'text_delta', { content: safeText });
                                                            streamBuffer = streamBuffer.slice(safeText.length);
                                                        }
                                                        break;
                                                    }
                                                }

                                                // 如果不仅没找到开头，连可能的开头都不是 -> 全部作为文本发送
                                                if (!partialMatch) {
                                                    if (streamBuffer) {
                                                        sendSSE(controller, 'text_delta', { content: streamBuffer });
                                                        streamBuffer = '';
                                                    }
                                                }
                                                break; // 退出循环，等待更多数据
                                            } else {
                                                // 找到了 ":::chart"

                                                // 1. 先把 chart 之前的内容作为文本发送
                                                if (chartStartIndex > 0) {
                                                    const textPart = streamBuffer.slice(0, chartStartIndex);
                                                    sendSSE(controller, 'text_delta', { content: textPart });
                                                    streamBuffer = streamBuffer.slice(chartStartIndex);
                                                }

                                                // 2. 现在 streamBuffer 以 ":::chart" 开头，寻找结束标记 ":::"
                                                // 注意：结束标记必须在开头之后。
                                                // ":::chart" len=8. End tag ":::" len=3.
                                                // 我们需要找的是内容之后的 ":::"，为了防止匹配到开头的 ":::" 中的一部分，我们从 index 8 开始找
                                                const chartEndIndex = streamBuffer.indexOf(':::', 8);

                                                if (chartEndIndex !== -1) {
                                                    // 找到了完整的图表块
                                                    const rawJson = streamBuffer.slice(8, chartEndIndex).trim(); // Remove ":::chart" and content trim
                                                    try {
                                                        const chartData = JSON.parse(rawJson);
                                                        // 发送图表事件
                                                        sendSSE(controller, 'content_block', { type: 'chart', data: chartData });
                                                    } catch (e) {
                                                        console.error('Chart JSON parse error:', e);
                                                        // 解析失败，回退为纯文本发送 (包含标记，让前端或其他逻辑处理，或者单纯显示)
                                                        // 这里选择作为文本发送，避免丢失信息
                                                        sendSSE(controller, 'text_delta', { content: streamBuffer.slice(0, chartEndIndex + 3) });
                                                    }

                                                    // 移除已处理的图表块 (including ending ":::")
                                                    streamBuffer = streamBuffer.slice(chartEndIndex + 3);
                                                    // 继续下一次循环，处理剩余字符
                                                } else {
                                                    // 还没传输完完整的图表，等待更多数据
                                                    break;
                                                }
                                            }
                                        }
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

                        // === 主流式循环后：Flush 剩余的 streamBuffer ===
                        if (streamBuffer) {
                            const chartStartIndex = streamBuffer.indexOf(':::chart');
                            if (chartStartIndex !== -1) {
                                const chartEndIndex = streamBuffer.indexOf(':::', 8);
                                if (chartEndIndex !== -1) {
                                    if (chartStartIndex > 0) {
                                        sendSSE(controller, 'text_delta', { content: streamBuffer.slice(0, chartStartIndex) });
                                    }
                                    const rawJson = streamBuffer.slice(8, chartEndIndex).trim();
                                    try {
                                        const chartData = JSON.parse(rawJson);
                                        sendSSE(controller, 'content_block', { type: 'chart', data: chartData });
                                    } catch (e) {
                                        console.error('[AI Main Stream] Chart parse error:', e.message);
                                        sendSSE(controller, 'text_delta', { content: streamBuffer.slice(0, chartEndIndex + 3) });
                                    }
                                    const afterChart = streamBuffer.slice(chartEndIndex + 3);
                                    if (afterChart) {
                                        sendSSE(controller, 'text_delta', { content: afterChart });
                                    }
                                } else {
                                    sendSSE(controller, 'text_delta', { content: streamBuffer });
                                }
                            } else {
                                sendSSE(controller, 'text_delta', { content: streamBuffer });
                            }
                            console.log(`[AI Main Stream] Flushed buffer: ${streamBuffer.length} chars`);
                            streamBuffer = ''; // Reset after flush
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
                                    summary: MSG.AI.TOOLS.RESULT_READY
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

                            // 进行终番回复 (改为流式请求以支持所有模型)
                            const finalStreamResult = await callAIStream(messages, [], env);
                            const finalReader = finalStreamResult.body.getReader();
                            let finalBuffer = '';
                            let finalFullContent = '';
                            let streamBuffer = ''; // Re-use buffering logic for charts

                            while (true) {
                                const { done, value } = await finalReader.read();
                                if (done) break;

                                finalBuffer += decoder.decode(value, { stream: true });
                                const lastNewlineIndex = finalBuffer.lastIndexOf('\n');
                                if (lastNewlineIndex !== -1) {
                                    const toParse = finalBuffer.slice(0, lastNewlineIndex + 1);
                                    finalBuffer = finalBuffer.slice(lastNewlineIndex + 1);

                                    const chunks = parseSSEChunk(toParse);
                                    for (const chunk of chunks) {
                                        if (chunk.done) continue;
                                        const delta = chunk.choices?.[0]?.delta;
                                        if (delta?.content) {
                                            finalFullContent += delta.content;
                                            streamBuffer += delta.content;

                                            // === 复用图表解析逻辑 ===
                                            while (true) {
                                                const chartStartIndex = streamBuffer.indexOf(':::chart');
                                                if (chartStartIndex === -1) {
                                                    let partialMatch = false;
                                                    const checkLen = Math.min(streamBuffer.length, 8);
                                                    for (let i = 1; i <= checkLen; i++) {
                                                        const suffix = streamBuffer.slice(-i);
                                                        if (":::chart".startsWith(suffix)) {
                                                            partialMatch = true;
                                                            const safeText = streamBuffer.slice(0, -i);
                                                            if (safeText) {
                                                                sendSSE(controller, 'text_delta', { content: safeText });
                                                                streamBuffer = streamBuffer.slice(safeText.length);
                                                            }
                                                            break;
                                                        }
                                                    }
                                                    if (!partialMatch) {
                                                        if (streamBuffer) {
                                                            sendSSE(controller, 'text_delta', { content: streamBuffer });
                                                            streamBuffer = '';
                                                        }
                                                    }
                                                    break;
                                                } else {
                                                    if (chartStartIndex > 0) {
                                                        const textPart = streamBuffer.slice(0, chartStartIndex);
                                                        sendSSE(controller, 'text_delta', { content: textPart });
                                                        streamBuffer = streamBuffer.slice(chartStartIndex);
                                                    }
                                                    const chartEndIndex = streamBuffer.indexOf(':::', 8);
                                                    if (chartEndIndex !== -1) {
                                                        const rawJson = streamBuffer.slice(8, chartEndIndex).trim();
                                                        try {
                                                            const chartData = JSON.parse(rawJson);
                                                            sendSSE(controller, 'content_block', { type: 'chart', data: chartData });
                                                        } catch (e) {
                                                            console.error('Chart JSON parse error:', e);
                                                            sendSSE(controller, 'text_delta', { content: streamBuffer.slice(0, chartEndIndex + 3) });
                                                        }
                                                        streamBuffer = streamBuffer.slice(chartEndIndex + 3);
                                                    } else {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // === 关键修复：Flush 剩余的 buffer ===
                            // 处理最后剩余的 finalBuffer (可能包含不完整的 SSE 行)
                            if (finalBuffer.trim()) {
                                const chunks = parseSSEChunk(finalBuffer);
                                for (const chunk of chunks) {
                                    if (chunk.done) continue;
                                    const delta = chunk.choices?.[0]?.delta;
                                    if (delta?.content) {
                                        streamBuffer += delta.content;
                                    }
                                }
                            }

                            // Flush streamBuffer 中剩余的非图表内容
                            if (streamBuffer) {
                                // 检查是否有未完成的图表块
                                const chartStartIndex = streamBuffer.indexOf(':::chart');
                                if (chartStartIndex !== -1) {
                                    // 尝试解析可能完整的图表
                                    const chartEndIndex = streamBuffer.indexOf(':::', 8);
                                    if (chartEndIndex !== -1) {
                                        // 发送图表前的文本
                                        if (chartStartIndex > 0) {
                                            sendSSE(controller, 'text_delta', { content: streamBuffer.slice(0, chartStartIndex) });
                                        }
                                        const rawJson = streamBuffer.slice(8, chartEndIndex).trim();
                                        try {
                                            const chartData = JSON.parse(rawJson);
                                            sendSSE(controller, 'content_block', { type: 'chart', data: chartData });
                                            console.log('[AI Stream] Final buffer chart sent successfully');
                                        } catch (e) {
                                            console.error('[AI Stream] Final buffer chart parse error:', e.message);
                                            console.log('[AI Stream] Raw chart JSON:', rawJson.slice(0, 200));
                                            sendSSE(controller, 'text_delta', { content: streamBuffer.slice(0, chartEndIndex + 3) });
                                        }
                                        // 发送图表后的剩余文本
                                        const afterChart = streamBuffer.slice(chartEndIndex + 3);
                                        if (afterChart) {
                                            sendSSE(controller, 'text_delta', { content: afterChart });
                                        }
                                    } else {
                                        // 图表不完整，作为文本发送
                                        console.warn('[AI Stream] Incomplete chart block in final buffer, sending as text');
                                        sendSSE(controller, 'text_delta', { content: streamBuffer });
                                    }
                                } else {
                                    // 没有图表，直接发送剩余文本
                                    sendSSE(controller, 'text_delta', { content: streamBuffer });
                                }
                                console.log(`[AI Stream] Flushed final buffer: ${streamBuffer.length} chars`);
                            }
                        }
                    } else {
                        // === 兼容降级模式 (非流式请求) ===
                        const response = await callAI(messages, AI_TOOLS, env);
                        let choice = response.choices[0];

                        // 处理单次往返中的工具调用
                        if (choice.message.tool_calls) {
                            messages.push(choice.message);

                            for (const toolCall of choice.message.tool_calls) {
                                const functionName = toolCall.function.name;
                                const args = JSON.parse(toolCall.function.arguments);

                                sendSSE(controller, 'tool_call', { name: functionName, status: 'started' });
                                const result = await executeTool(functionName, args);
                                sendSSE(controller, 'tool_result', { name: functionName, summary: MSG.AI.TOOLS.RESULT_READY });

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
