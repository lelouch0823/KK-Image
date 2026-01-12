/**
 * AI 流式聊天 API (Admin Only)
 * POST /api/ai/stream
 * 
 * 返回 SSE 格式的流式响应，支持工具调用和增量文本输出。
 * 
 * 架构说明：
 * - 流式传输期间：只发送纯文本内容（实时打字机效果）
 * - 流结束时：解析并发送图表数据（避免重复内容）
 * - 工具调用：执行后重新调用 AI 获取最终解读
 */
/* global ReadableStream */
import { MSG } from '../utils/messages.js';
import { AI_TOOLS } from '../utils/ai-prompts.js';
import { authenticateAdmin } from '../utils/auth.js';
import { OrderStatsRepository } from '../../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../../repositories/SystemStatsRepository.js';
import { callAIStream, callAI, parseSSEChunk, SYSTEM_PROMPT } from '../../utils/ai-utils.js';
import { executeAITool } from '../../utils/ai-tool-executor.js';
import { extractToolCallsFromText, createSSESender } from '../../utils/ai-stream-helpers.js';

export async function onRequestPost(context) {
    const { env, request } = context;
    const encoder = new TextEncoder();

    try {
        // 1. 权限验证
        await authenticateAdmin(request, env);
        const { messages: history, context: clientContext = {} } = await request.json();

        // 2. 初始化仓库
        const orderStatsRepo = new OrderStatsRepository(env.DB);
        const systemStatsRepo = new SystemStatsRepository(env.DB);

        // 3. 工具执行函数
        const executeTool = async (name, args) => {
            return await executeAITool(name, args, { orderStatsRepo, systemStatsRepo });
        };

        // 4. 创建 SSE 流
        const stream = new ReadableStream({
            async start(controller) {
                const sendSSE = createSSESender(controller, encoder);

                try {
                    const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
                    const systemContent = SYSTEM_PROMPT(todayDate, clientContext);
                    let messages = [{ role: "system", content: systemContent }, ...history];

                    // === 首轮 AI 调用 ===
                    let useStreaming = true;
                    let aiStream;

                    try {
                        const streamResult = await callAIStream(messages, AI_TOOLS, env);
                        aiStream = streamResult.body;

                        if (streamResult.switched) {
                            sendSSE('model_switch', { model: streamResult.model, reason: 'rate_limit' });
                        }
                    } catch (e) {
                        console.error('[AI Stream] Fallback to non-streaming:', e.message);
                        useStreaming = false;
                    }

                    if (useStreaming && aiStream) {
                        // === 流式模式 ===
                        const result = await processStream(aiStream, sendSSE);

                        // 处理工具调用
                        if (result.toolCalls.length > 0) {
                            await handleToolCalls(result.toolCalls, result.fullContent, messages, executeTool, sendSSE, env);
                        }
                    } else {
                        // === 非流式模式 ===
                        await handleNonStreaming(messages, executeTool, sendSSE, env);
                    }

                    sendSSE('done', {});
                } catch (err) {
                    console.error('[AI Stream] Error:', err);
                    sendSSE('error', { message: err.message });
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

/**
 * 处理流式响应
 * - 累积内容并实时发送文本
 * - 检测文本格式的工具调用
 */
async function processStream(aiStream, sendSSE) {
    const reader = aiStream.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let fullContent = '';
    let toolCalls = [];

    // 用于检测图表开始标记的简单状态
    let pendingText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lastNewlineIndex = buffer.lastIndexOf('\n');

        if (lastNewlineIndex !== -1) {
            const toParse = buffer.slice(0, lastNewlineIndex + 1);
            buffer = buffer.slice(lastNewlineIndex + 1);

            const chunks = parseSSEChunk(toParse);
            for (const chunk of chunks) {
                if (chunk.done) continue;

                const delta = chunk.choices?.[0]?.delta;
                if (!delta) continue;

                // 处理文本内容
                if (delta.content) {
                    fullContent += delta.content;
                    pendingText += delta.content;

                    // 检查是否有 :::chart 标记开始
                    // 如果有，暂停发送直到图表完成或确认不是图表
                    const safeText = getSafeTextForStreaming(pendingText);
                    if (safeText) {
                        sendSSE('text_delta', { content: safeText });
                        pendingText = pendingText.slice(safeText.length);
                    }
                }

                // 处理工具调用
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

    // === 流结束：处理剩余内容 ===
    // 1. 先处理剩余的 buffer
    if (buffer.trim()) {
        const chunks = parseSSEChunk(buffer);
        for (const chunk of chunks) {
            if (chunk.done) continue;
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
                pendingText += delta.content;
            }
        }
    }

    // 2. 发送剩余的 pendingText
    if (pendingText) {
        sendSSE('text_delta', { content: pendingText });
    }
    // 3. 检查是否需要从文本中提取工具调用 (某些模型的兼容)
    if (toolCalls.length === 0 && fullContent) {
        const { cleanText, toolCalls: textToolCalls } = extractToolCallsFromText(fullContent);
        if (textToolCalls.length > 0) {
            console.log(`[AI Stream] Detected ${textToolCalls.length} text-based tool calls`);
            toolCalls = textToolCalls;
            // 重新发送清理后的文本（如果有的话）
            if (cleanText && cleanText !== fullContent) {
                // 注意：已经发送的文本无法撤回，但我们可以在 handleToolCalls 后发送最终内容
                fullContent = cleanText;
            }
        }
    }

    return { fullContent, toolCalls };
}

/**
 * 获取可以安全发送的文本（不包含文本格式的工具调用）
 */
function getSafeTextForStreaming(text) {
    // 只检测文本格式工具调用标记
    const toolsMarker = '<tools';
    const toolsIndex = text.indexOf(toolsMarker);

    if (toolsIndex !== -1) {
        // 有工具调用标记，只返回之前的部分
        return text.slice(0, toolsIndex);
    }

    // 检查是否有部分匹配（可能的标记开始）
    for (let i = 1; i <= toolsMarker.length; i++) {
        if (text.endsWith(toolsMarker.slice(0, i))) {
            return text.slice(0, -i);
        }
    }

    // 没有任何匹配，全部安全
    return text;
}

/**
 * 处理工具调用
 */
async function handleToolCalls(toolCalls, fullContent, messages, executeTool, sendSSE, env) {
    for (const tc of toolCalls) {
        if (!tc.name) continue;

        sendSSE('tool_call', { name: tc.name, status: 'started' });

        const args = tc.arguments ? JSON.parse(tc.arguments) : {};
        const result = await executeTool(tc.name, args);

        sendSSE('tool_result', { name: tc.name, summary: MSG.AI.TOOLS.RESULT_READY });

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

    // 获取最终解读（使用流式）
    const finalResult = await callAIStream(messages, [], env);
    const { fullContent: finalContent } = await processStream(finalResult.body, sendSSE);

    // 不需要返回，内容已在 processStream 中发送
    console.log(`[AI Stream] Tool response processed: ${finalContent.length} chars`);
}

/**
 * 处理非流式模式
 */
async function handleNonStreaming(messages, executeTool, sendSSE, env) {
    const response = await callAI(messages, AI_TOOLS, env);
    let choice = response.choices[0];

    // 处理工具调用
    if (choice.message.tool_calls) {
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
            const funcName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            sendSSE('tool_call', { name: funcName, status: 'started' });
            const result = await executeTool(funcName, args);
            sendSSE('tool_result', { name: funcName, summary: MSG.AI.TOOLS.RESULT_READY });

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: funcName,
                content: JSON.stringify(result)
            });
        }

        const finalResponse = await callAI(messages, [], env);
        choice = finalResponse.choices[0];
    }

    // 发送内容（分块模拟流式）
    const content = choice.message.content || '';
    const chunkSize = 20;
    for (let i = 0; i < content.length; i += chunkSize) {
        sendSSE('text_delta', { content: content.slice(i, i + chunkSize) });
    }
}
