import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { MSG } from '../../../../api/utils/messages.js';
import { AI_TOOLS } from '../../../../api/utils/ai-prompts.js';
import { OrderStatsRepository } from '../../../../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../../../../repositories/SystemStatsRepository.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../../../../repositories/OrderTimelineRepository.js';
import { ProductRepository } from '../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../repositories/ProductVariantRepository.js';
import { CustomerRepository } from '../../../../repositories/CustomerRepository.js';
import { GoodsOverviewRepository } from '../../../../repositories/GoodsOverviewRepository.js';
import { PurchaseOrderRepository } from '../../../../repositories/PurchaseOrderRepository.js';
import { SettingsRepository } from '../../../../repositories/SettingsRepository.js';
import { callAIStream, callAI, callAIAuto, parseSSEChunk, SYSTEM_PROMPT } from '../../../../utils/ai-utils.js';
import { executeAITool } from '../../../../utils/ai-tool-executor.js';
import { extractToolCallsFromText, ContentGate } from '../../../../utils/ai-stream-helpers.js';
import { DateUtils } from '../../../../api/utils/date.js';
import { success } from '../../../../api/utils/response.js';

const app = new Hono();
const MAX_TOOL_ROUNDS = 3;
const MAX_TOOLS_PER_ROUND = 8;
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions?/i,
    /disregard\s+(all\s+)?(system|developer)\s+instructions?/i,
    /reveal\s+(the\s+)?system\s+prompt/i,
    /show\s+(me\s+)?(your\s+)?(hidden|internal)\s+(prompt|rules?)/i,
    /developer\s+message/i,
    /print\s+(all\s+)?environment\s+variables?/i,
    /api[_\s-]?key|secret|token/i,
    /越狱|忽略(以上|之前|先前)指令|泄露(系统|提示词|密钥)/i,
];

function parseBooleanFlag(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

function detectInjectionSignals(rawText = '') {
    const text = String(rawText || '');
    if (!text.trim()) return [];
    return INJECTION_PATTERNS
        .filter((pattern) => pattern.test(text))
        .map((pattern) => pattern.toString());
}

function logInjectionTelemetry(channel, entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    console.warn('[AI PromptInjection][Detected]', JSON.stringify({
        channel,
        count: entries.length,
        entries: entries.slice(0, 6),
    }));
}

async function resolveAIRuntimeEnv(env) {
    try {
        const settingsRepo = new SettingsRepository(env.DB);
        const grouped = await settingsRepo.getAllGrouped();
        const ai = grouped?.ai || {};
        const pick = (key, fallback = '') => {
            const value = String(ai[key] ?? '').trim();
            return value || fallback;
        };

        return {
            ...env,
            AI_API_URL: pick('AI_API_URL', env.AI_API_URL || ''),
            AI_API_KEY: pick('AI_API_KEY', env.AI_API_KEY || ''),
            AI_MODELS: pick('AI_MODELS', env.AI_MODELS || env.AI_MODEL || ''),
            AI_MODEL: pick('AI_MODEL', env.AI_MODEL || ''),
            AI_DYNAMIC_FALLBACK_ENABLED: pick('AI_DYNAMIC_FALLBACK_ENABLED', env.AI_DYNAMIC_FALLBACK_ENABLED || 'false'),
            AI_MODEL_HEALTH_WINDOW: pick('AI_MODEL_HEALTH_WINDOW', env.AI_MODEL_HEALTH_WINDOW || '20'),
            AI_MODEL_SWITCH_THRESHOLD: pick('AI_MODEL_SWITCH_THRESHOLD', env.AI_MODEL_SWITCH_THRESHOLD || '5'),
            AI_STREAM_GATE_ENABLED: pick('AI_STREAM_GATE_ENABLED', env.AI_STREAM_GATE_ENABLED || 'true'),
            AI_STREAM_GATE_STRICT_MODE: pick('AI_STREAM_GATE_STRICT_MODE', env.AI_STREAM_GATE_STRICT_MODE || 'false'),
        };
    } catch (error) {
        console.warn('[AI] Failed to load runtime AI settings from DB, fallback to env:', error?.message);
        return env;
    }
}

/**
 * 报告生成的 System Prompt
 */
const REPORT_SYSTEM_PROMPT = (date, toolResults) => `
你是一个专业的报告生成 AI。根据以下数据生成一份精美的 HTML 报告。

当前日期：${date}

**可用数据**：
${JSON.stringify(toolResults, null, 2)}

**要求**：
1. 生成一个完整的 HTML 文档（包含 <!DOCTYPE html>、<html>、<head>、<body>）
2. 在 <head> 中引入 Chart.js CDN：<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
3. 使用内联 CSS 美化页面，设计要求：
   - 最大宽度 1200px，居中显示
   - 使用系统字体 (system-ui)
   - 卡片式布局，圆角 + 阴影
   - 主色调：#6366f1（靛蓝色）
4. 用 <canvas> 和 Chart.js 渲染图表：
   - 订单趋势用折线图或柱状图
   - 文件类型分布用饼图或环形图
   - 销售排行用水平柱状图
5. 用 HTML <table> 展示待处理订单列表
6. 在页面顶部显示报告标题和生成时间
7. 只输出 HTML 代码，不要输出其他任何内容

生成的 HTML 应该是一个完整的、可直接在浏览器中打开的网页。
`;

/**
 * POST /chat - AI 聊天 (非流式)
 */
app.post('/chat', async (c) => {
    const { env } = c;
    const { messages: history, context: clientContext = {} } = await c.req.json();
    const runtimeEnv = await resolveAIRuntimeEnv(env);
    const userSignals = history
        .filter((msg) => msg?.role === 'user')
        .flatMap((msg) => detectInjectionSignals(msg.content));
    logInjectionTelemetry('chat.user_input', userSignals);


        const orderStatsRepo = new OrderStatsRepository(env.DB);
        const systemStatsRepo = new SystemStatsRepository(env.DB);
        const orderRepo = new OrderRepository(env.DB);
        const orderTimelineRepo = new OrderTimelineRepository(env.DB);
        const productRepo = new ProductRepository(env.DB);
        const variantRepo = new ProductVariantRepository(env.DB);
        const customerRepo = new CustomerRepository(env.DB);
        const goodsOverviewRepo = new GoodsOverviewRepository(env.DB);
        const purchaseOrderRepo = new PurchaseOrderRepository(env.DB);

        const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const systemContent = SYSTEM_PROMPT(todayDate, clientContext);

        let messages = [{ role: "system", content: systemContent }, ...history];

        let response = await callAI(messages, AI_TOOLS, runtimeEnv);
        let choice = response.choices[0];

        if (choice.message.tool_calls) {
            messages.push(choice.message);
            for (const toolCall of choice.message.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                const result = await executeAITool(functionName, args, { 
                    orderStatsRepo, systemStatsRepo, orderRepo, orderTimelineRepo, productRepo, variantRepo, customerRepo, goodsOverviewRepo, purchaseOrderRepo
                });
                logInjectionTelemetry(`chat.tool_result.${functionName}`, detectInjectionSignals(JSON.stringify(result)));

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(result)
                });
            }
            response = await callAI(messages, [], runtimeEnv);
        }

        return success({ message: response.choices[0].message });
});

/**
 * POST /report - AI 报告生成
 */
app.post('/report', async (c) => {
    const { env } = c;
    const runtimeEnv = await resolveAIRuntimeEnv(env);
    const orderStatsRepo = new OrderStatsRepository(env.DB);
        const systemStatsRepo = new SystemStatsRepository(env.DB);

        const todayStart = DateUtils.getChinaDayStart();
        const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
        const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

        const [orderStats, pendingOrders, customerStats, spaceStats, salespersonStats, fileStats] = await Promise.all([
            orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart),
            orderStatsRepo.getRecentPending(5),
            systemStatsRepo.getCustomerStats(),
            systemStatsRepo.getSpaceStats(),
            systemStatsRepo.getSalespersonStats(),
            systemStatsRepo.getFileStats()
        ]);

        const toolResults = { orderStats, pendingOrders, customerStats, spaceStats, salespersonStats, fileStats };
        const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const messages = [
            { role: 'system', content: REPORT_SYSTEM_PROMPT(todayDate, toolResults) },
            { role: 'user', content: '请根据以上数据生成完整的 HTML 报告。' }
        ];

        const result = await callAIAuto({ messages, tools: [], env: runtimeEnv, preferStream: true });
        let cleanHtml = result.content || '';
        
        // 清理 Markdown 代码块
        cleanHtml = cleanHtml.replace(/^```html\n?|```$/g, '').trim();

    return success({ html: cleanHtml });
});

/**
 * POST /stream - AI 流式聊天 (SSE)
 */
app.post('/stream', async (c) => {
    const { env } = c;
    const { messages: history, context: clientContext = {} } = await c.req.json();
    const runtimeEnv = await resolveAIRuntimeEnv(env);
    const userSignals = history
        .filter((msg) => msg?.role === 'user')
        .flatMap((msg) => detectInjectionSignals(msg.content));
    logInjectionTelemetry('stream.user_input', userSignals);

    return streamSSE(c, async (stream) => {
        try {
            const orderStatsRepo = new OrderStatsRepository(env.DB);
            const systemStatsRepo = new SystemStatsRepository(env.DB);
            const orderRepo = new OrderRepository(env.DB);
            const orderTimelineRepo = new OrderTimelineRepository(env.DB);
            const productRepo = new ProductRepository(env.DB);
            const variantRepo = new ProductVariantRepository(env.DB);
            const customerRepo = new CustomerRepository(env.DB);
            const goodsOverviewRepo = new GoodsOverviewRepository(env.DB);
            const purchaseOrderRepo = new PurchaseOrderRepository(env.DB);

            const executeTool = async (name, args) => {
                const result = await executeAITool(name, args, { 
                    orderStatsRepo, systemStatsRepo, orderRepo, orderTimelineRepo, productRepo, variantRepo, customerRepo, goodsOverviewRepo, purchaseOrderRepo
                });
                logInjectionTelemetry(`stream.tool_result.${name}`, detectInjectionSignals(JSON.stringify(result)));
                return result;
            };

            const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
            const systemContent = SYSTEM_PROMPT(todayDate, clientContext);
            let messages = [{ role: "system", content: systemContent }, ...history];

            const streamResult = await callAIStream(messages, AI_TOOLS, runtimeEnv);
            const aiStream = streamResult.body;

            if (streamResult.switched) {
                await stream.writeSSE({ event: 'model_switch', data: JSON.stringify({ model: streamResult.model, reason: 'rate_limit' }) });
            }

            const gateEnabled = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_ENABLED, true);
            const strictMode = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_STRICT_MODE, false);
            const initialParsed = await processStreamToSSE(aiStream, stream, { gateEnabled, strictMode });
            const { fullContent, toolCalls } = initialParsed;
            let roundTelemetry = { rounds: 0, executedTools: 0, lastToolCalls: toolCalls.length };

            if (toolCalls.length > 0) {
                roundTelemetry = await handleToolCallsToSSE(toolCalls, fullContent, messages, executeTool, stream, runtimeEnv, { gateEnabled, strictMode });
            }

            if (gateEnabled) {
                const gateStats = initialParsed.gateStats || {};
                const suspectedFalsePositive = gateStats.blockedEvents > 0 && toolCalls.length === 0 && roundTelemetry.executedTools === 0;
                console.info('[AI Stream][GateTelemetry]', JSON.stringify({
                    blockedEvents: gateStats.blockedEvents || 0,
                    blockedChars: gateStats.blockedChars || 0,
                    recoveredEvents: gateStats.recoveredEvents || 0,
                    recoveredChars: gateStats.recoveredChars || 0,
                    suspectTransitions: gateStats.suspectTransitions || 0,
                    toolRounds: roundTelemetry.rounds || 0,
                    executedTools: roundTelemetry.executedTools || 0,
                    suspectedFalsePositive,
                }));
            }

            await stream.writeSSE({ event: 'done', data: '{}' });
        } catch (err) {
            console.error('[AI Hono Stream] Error:', err);
            await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: err.message }) });
        }
    });
});

/**
 * 内部辅助：处理流并发送到 SSE
 */
async function processStreamToSSE(aiStream, sseStream, options = {}) {
    const reader = aiStream.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let toolCalls = [];
    let buffer = '';
    const gateEnabled = options.gateEnabled !== false;
    const gate = gateEnabled ? new ContentGate({
        lookahead: 80,
        suspectWindow: options.strictMode ? 260 : 220,
    }) : null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop();

        for (const part of parts) {
            const chunks = parseSSEChunk(part + '\n');
            for (const chunk of chunks) {
                if (chunk.done) continue;
                const delta = chunk.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                    fullContent += delta.content;
                    if (!gate) {
                        await sseStream.writeSSE({ event: 'text_delta', data: JSON.stringify({ content: delta.content }) });
                    } else {
                        const { safeText } = gate.push(delta.content);
                        if (safeText) {
                            await sseStream.writeSSE({ event: 'text_delta', data: JSON.stringify({ content: safeText }) });
                        }
                    }
                }

                if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        if (tc.index !== undefined) {
                            if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', name: '', arguments: '' };
                            if (tc.id) toolCalls[tc.index].id = tc.id;
                            if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                            if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
                        }
                    }
                }
            }
        }
    }

    if (gate) {
        const remaining = gate.flush();
        if (remaining) {
            await sseStream.writeSSE({ event: 'text_delta', data: JSON.stringify({ content: remaining }) });
        }
    }

    // 3. 检查是否需要从文本中提取工具调用 (某些模型的兼容)
    if (toolCalls.length === 0 && fullContent) {
        const { cleanText, toolCalls: textToolCalls } = extractToolCallsFromText(fullContent);
        if (textToolCalls.length > 0) {
            console.log(`[AI Stream] Detected ${textToolCalls.length} text-based tool calls`);
            toolCalls = textToolCalls;
            fullContent = cleanText;
        }
    }

    return {
        fullContent,
        toolCalls,
        gateStats: gate?.getStats ? gate.getStats() : null,
    };
}

/**
 * 内部辅助：处理工具调用并发送到 SSE
 */
async function handleToolCallsToSSE(toolCalls, fullContent, messages, executeTool, sseStream, env, streamOptions = {}) {
    let round = 0;
    let pendingCalls = toolCalls;
    let currentContent = fullContent;
    let executedTools = 0;

    while (pendingCalls.length > 0 && round < MAX_TOOL_ROUNDS) {
        round += 1;
        const roundCalls = pendingCalls
            .filter((tc) => tc?.name)
            .slice(0, MAX_TOOLS_PER_ROUND);
        if (roundCalls.length === 0) break;

        messages.push({
            role: 'assistant',
            content: currentContent || null,
            tool_calls: roundCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.arguments }
            }))
        });

        for (const tc of roundCalls) {
            await sseStream.writeSSE({ event: 'tool_call', data: JSON.stringify({ name: tc.name, status: 'started' }) });

            let args = {};
            try {
                args = tc.arguments ? JSON.parse(tc.arguments) : {};
            } catch (_parseErr) {
                console.warn(`[AI Stream] Failed to parse tool arguments: ${tc.arguments}`);
            }

            const result = await executeTool(tc.name, args);
            await sseStream.writeSSE({ event: 'tool_result', data: JSON.stringify({ name: tc.name, summary: MSG.AI.TOOLS.RESULT_READY }) });
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
            executedTools += 1;
        }

        currentContent = null;
        const nextResult = await callAIStream(messages, AI_TOOLS, env);
        if (nextResult.switched) {
            await sseStream.writeSSE({ event: 'model_switch', data: JSON.stringify({ model: nextResult.model, reason: 'rate_limit' }) });
        }
        const parsed = await processStreamToSSE(nextResult.body, sseStream, streamOptions);
        pendingCalls = parsed.toolCalls;
        currentContent = parsed.fullContent;
    }

    if (round >= MAX_TOOL_ROUNDS && pendingCalls.length > 0) {
        console.warn(`[AI Stream] Reached max tool call rounds (${MAX_TOOL_ROUNDS}), stopping`);
    }

    return {
        rounds: round,
        executedTools,
        lastToolCalls: pendingCalls.length,
    };
}

export default app;
