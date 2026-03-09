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
import { requirePermission } from '../../middleware/auth.js';
import { AIActionOrchestrator } from '../../../../ai/action-orchestrator.js';
import { D1ActionSessionStore } from '../../../../ai/action-session-store.js';
import { createActionSubmitters } from '../../../../ai/action-submitters.js';
import { getActionAdapter } from '../../../../ai/action-registry.js';

const app = new Hono();
app.use('*', requirePermission('stats:read'));
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

function parseModelListForLog(modelsValue = '') {
    return String(modelsValue || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function summarizeImageUrl(url = '') {
    const value = String(url || '');
    const isDataUrl = value.startsWith('data:');
    const isHttpUrl = /^https?:\/\//i.test(value);
    let mime = '';
    if (isDataUrl) {
        const match = value.match(/^data:([^;,]+)/i);
        mime = match?.[1] || '';
    }
    return {
        isDataUrl,
        isHttpUrl,
        mime: mime || null,
        length: value.length || 0,
    };
}

function summarizeUserInputModalities(history = []) {
    const summary = {
        userMessageCount: 0,
        textParts: 0,
        imageParts: 0,
        dataUrlImages: 0,
        httpUrlImages: 0,
        imageMimes: [],
        maxImageUrlLength: 0,
    };
    const mimeSet = new Set();

    const visitContent = (content) => {
        if (typeof content === 'string') {
            if (content.trim()) summary.textParts += 1;
            return;
        }
        if (Array.isArray(content)) {
            content.forEach(visitContent);
            return;
        }
        if (!content || typeof content !== 'object') return;

        if (content.type === 'text' && typeof content.text === 'string' && content.text.trim()) {
            summary.textParts += 1;
            return;
        }

        if (content.type === 'image_url' && typeof content.image_url?.url === 'string') {
            summary.imageParts += 1;
            const imageInfo = summarizeImageUrl(content.image_url.url);
            if (imageInfo.isDataUrl) summary.dataUrlImages += 1;
            if (imageInfo.isHttpUrl) summary.httpUrlImages += 1;
            if (imageInfo.mime) mimeSet.add(imageInfo.mime);
            summary.maxImageUrlLength = Math.max(summary.maxImageUrlLength, imageInfo.length);
            return;
        }

        if (typeof content.text === 'string' && content.text.trim()) {
            summary.textParts += 1;
        }
    };

    if (Array.isArray(history)) {
        history
            .filter((msg) => msg?.role === 'user')
            .forEach((msg) => {
                summary.userMessageCount += 1;
                visitContent(msg.content);
            });
    }

    summary.imageMimes = Array.from(mimeSet);
    return summary;
}

function logModelUsageTelemetry(channel, {
    runtimeEnv = {},
    selectedModel = '',
    switched = false,
    visionFirst = false,
    toolsEnabled = true,
    phase = 'initial',
} = {}) {
    const configuredModels = parseModelListForLog(runtimeEnv.AI_MODELS || runtimeEnv.AI_MODEL || '');
    console.info(`[AI ${channel}][ModelUsed]`, JSON.stringify({
        phase,
        selectedModel: selectedModel || null,
        switched: Boolean(switched),
        configuredPrimary: configuredModels[0] || null,
        configuredCount: configuredModels.length,
        dynamicFallbackEnabled: parseBooleanFlag(runtimeEnv.AI_DYNAMIC_FALLBACK_ENABLED, false),
        visionFirst: Boolean(visionFirst),
        toolsEnabled: Boolean(toolsEnabled),
    }));
}

function detectInjectionSignals(rawText = '') {
    const text = String(rawText || '');
    if (!text.trim()) return [];
    return INJECTION_PATTERNS
        .filter((pattern) => pattern.test(text))
        .map((pattern) => pattern.toString());
}

function hasImagePart(content) {
    if (Array.isArray(content)) {
        return content.some((part) => part?.type === 'image_url' && typeof part.image_url?.url === 'string');
    }
    if (content && typeof content === 'object') {
        return content.type === 'image_url' && typeof content.image_url?.url === 'string';
    }
    return false;
}

function hasImageInLatestUserTurn(history = []) {
    if (!Array.isArray(history) || history.length === 0) return false;
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (msg?.role !== 'user') continue;
        return hasImagePart(msg.content);
    }
    return false;
}

function buildSystemContent(basePrompt, { visionFirst = false } = {}) {
    if (!visionFirst) return basePrompt;
    return `${basePrompt}

<vision_first_mode>
图像优先：本轮用户输入包含图片，你必须优先基于图片内容回答，不要优先转成 SKU/ID 检索问答。
若当前模型无法识别图片，请以以下前缀开头回复：
[IMAGE_UNSUPPORTED] 当前模型无法识别图片，请移除图片或切换模型。
</vision_first_mode>`.trim();
}

function extractUserTextForDetection(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter((part) => part?.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .join('\n');
    }
    if (content && typeof content === 'object') {
        if (content.type === 'text' && typeof content.text === 'string') {
            return content.text;
        }
        if (typeof content.text === 'string') {
            return content.text;
        }
    }
    return '';
}

function logInjectionTelemetry(channel, entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    console.warn('[AI PromptInjection][Detected]', JSON.stringify({
        channel,
        count: entries.length,
        entries: entries.slice(0, 6),
    }));
}

function extractLatestUserText(history = []) {
    if (!Array.isArray(history) || history.length === 0) return '';
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const msg = history[i];
        if (msg?.role !== 'user') continue;
        return extractUserTextForDetection(msg.content);
    }
    return '';
}

function detectExplicitConfirmation(text = '') {
    const normalized = String(text || '').trim();
    if (!normalized) return false;
    return /^(确认|确定|提交|创建吧|就这样|可以创建了)$/.test(normalized);
}

function createActionOrchestrator(env) {
    return new AIActionOrchestrator({
        sessionStore: new D1ActionSessionStore(env.DB),
        getActionAdapter,
        submitters: createActionSubmitters({}),
    });
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
    const visionFirst = hasImageInLatestUserTurn(history);
    const inputSummary = summarizeUserInputModalities(history);
    const userSignals = history
        .filter((msg) => msg?.role === 'user')
        .flatMap((msg) => detectInjectionSignals(extractUserTextForDetection(msg.content)));
    logInjectionTelemetry('chat.user_input', userSignals);
    console.info('[AI Chat][InputModalities]', JSON.stringify(inputSummary));

    const latestUserText = extractLatestUserText(history);
    const actionOrchestrator = createActionOrchestrator(env);
    const actionResult = await actionOrchestrator.advance({
        userId: c.get('user')?.id || 'anonymous',
        text: latestUserText,
        confirmation: detectExplicitConfirmation(latestUserText),
    });
    if (actionResult) {
        return success({
            message: {
                role: 'assistant',
                content: actionResult.payload?.successMessage || actionResult.kind,
                action: actionResult,
            },
        });
    }


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
        const systemContent = buildSystemContent(
            SYSTEM_PROMPT(todayDate, clientContext),
            { visionFirst }
        );

        let messages = [{ role: "system", content: systemContent }, ...history];

        let response = await callAI(messages, visionFirst ? [] : AI_TOOLS, runtimeEnv);
        logModelUsageTelemetry('Chat', {
            runtimeEnv,
            selectedModel: response?._meta?.model,
            switched: response?._meta?.switched,
            visionFirst,
            toolsEnabled: !visionFirst && Array.isArray(AI_TOOLS) && AI_TOOLS.length > 0,
            phase: 'initial',
        });
        let choice = response.choices[0];
        if (typeof choice?.message?.content === 'string' && choice.message.content.includes('[IMAGE_UNSUPPORTED]')) {
            console.warn('[AI Chat][ImageUnsupportedResponse]', JSON.stringify({
                selectedModel: response?._meta?.model || null,
                switched: Boolean(response?._meta?.switched),
                visionFirst,
                inputSummary,
            }));
        }

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
            logModelUsageTelemetry('Chat', {
                runtimeEnv,
                selectedModel: response?._meta?.model,
                switched: response?._meta?.switched,
                visionFirst,
                toolsEnabled: false,
                phase: 'post_tool',
            });
            const postToolContent = String(response?.choices?.[0]?.message?.content || '');
            if (postToolContent.includes('[IMAGE_UNSUPPORTED]')) {
                console.warn('[AI Chat][ImageUnsupportedResponse]', JSON.stringify({
                    selectedModel: response?._meta?.model || null,
                    switched: Boolean(response?._meta?.switched),
                    visionFirst,
                    inputSummary,
                    phase: 'post_tool',
                }));
            }
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
    const visionFirst = hasImageInLatestUserTurn(history);
    const inputSummary = summarizeUserInputModalities(history);
    const userSignals = history
        .filter((msg) => msg?.role === 'user')
        .flatMap((msg) => detectInjectionSignals(extractUserTextForDetection(msg.content)));
    logInjectionTelemetry('stream.user_input', userSignals);
    console.info('[AI Stream][InputModalities]', JSON.stringify(inputSummary));

    const latestUserText = extractLatestUserText(history);
    const actionOrchestrator = createActionOrchestrator(env);
    const actionResult = await actionOrchestrator.advance({
        userId: c.get('user')?.id || 'anonymous',
        text: latestUserText,
        confirmation: detectExplicitConfirmation(latestUserText),
    });

    return streamSSE(c, async (stream) => {
        try {
            if (actionResult) {
                await stream.writeSSE({ event: actionResult.kind, data: JSON.stringify(actionResult.payload || {}) });
                if (actionResult.kind === 'action_submitted' && actionResult.payload?.targetModule) {
                    await stream.writeSSE({
                        event: 'module_refresh',
                        data: JSON.stringify({
                            module: actionResult.payload.targetModule,
                            reason: 'ai_created',
                            entityId: actionResult.payload.createdEntityId || null,
                            timestamp: Date.now(),
                            silent: true,
                        }),
                    });
                }
                await stream.writeSSE({ event: 'done', data: '{}' });
                return;
            }

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
            const systemContent = buildSystemContent(
                SYSTEM_PROMPT(todayDate, clientContext),
                { visionFirst }
            );
            let messages = [{ role: "system", content: systemContent }, ...history];

            const streamResult = await callAIStream(messages, visionFirst ? [] : AI_TOOLS, runtimeEnv);
            const aiStream = streamResult.body;
            logModelUsageTelemetry('Stream', {
                runtimeEnv,
                selectedModel: streamResult.model,
                switched: streamResult.switched,
                visionFirst,
                toolsEnabled: !visionFirst && Array.isArray(AI_TOOLS) && AI_TOOLS.length > 0,
                phase: 'initial',
            });

            if (streamResult.switched) {
                await stream.writeSSE({ event: 'model_switch', data: JSON.stringify({ model: streamResult.model, reason: 'rate_limit' }) });
            }

            const gateEnabled = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_ENABLED, true);
            const strictMode = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_STRICT_MODE, false);
            const initialParsed = await processStreamToSSE(aiStream, stream, { gateEnabled, strictMode });
            const { fullContent, toolCalls } = initialParsed;
            let roundTelemetry = { rounds: 0, executedTools: 0, lastToolCalls: toolCalls.length };
            if (String(fullContent || '').includes('[IMAGE_UNSUPPORTED]')) {
                console.warn('[AI Stream][ImageUnsupportedResponse]', JSON.stringify({
                    selectedModel: streamResult.model || null,
                    switched: Boolean(streamResult.switched),
                    visionFirst,
                    inputSummary,
                    phase: 'initial',
                }));
            }

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
