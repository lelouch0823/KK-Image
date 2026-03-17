import { Hono } from 'hono';
import { parseJsonObject } from '../../../../api/utils/json.js';
import { streamSSE } from 'hono/streaming';
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
import { callAIStream, callAI, callAIAuto, parseSSEChunk, SYSTEM_PROMPT } from '../../../../utils/ai-utils.js';
import { executeAITool } from '../../../../utils/ai-tool-executor.js';
import { DateUtils } from '../../../../api/utils/date.js';
import { success } from '../../../../api/utils/response.js';
import { requirePermission } from '../../middleware/auth.js';
import { detectInjectionSignals, prepareConversationRequest } from '../../../../ai/conversation-service.js';
import { runAIStreamEngine } from '../../../../ai/stream-engine.js';
import { createAIActionService } from '../../../../ai/action-service.js';
import { createAIRequestTelemetry, createAISpanRecord, createAITraceRecord, createAIUsageDailyRecord } from '../../../../ai/telemetry.js';
import { createManagedOrder } from './orders/create-order.js';
import { createManagedProduct } from './products/create-product.js';
import { AIConfigManager } from '../../../../ai/config-manager.js';
import { createAIRequestContext } from '../../../../ai/request-context.js';
import { aiRateLimitMiddleware } from '../../middleware/ai-rate-limit.js';
import { createAITelemetryWriter } from '../../../../ai/telemetry-writer.js';
import { validateAIRequest } from '../../../../ai/input-validator.js';

const app = new Hono();
app.use('*', requirePermission('stats:read'));
app.use('*', aiRateLimitMiddleware);

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

function logInjectionTelemetry(channel, entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    console.warn('[AI PromptInjection][Detected]', JSON.stringify({
        channel,
        count: entries.length,
        entries: entries.slice(0, 6),
    }));
}

function createRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `req-${Date.now()}`;
}

function createTelemetryWriter(env) {
    return createAITelemetryWriter({ db: env?.DB });
}

function estimateUsageTokens(history = []) {
    const raw = JSON.stringify(history || []);
    return Math.max(1, Math.ceil(raw.length / 4));
}

async function resolveAIRuntimeEnv(env) {
    try {
        const configManager = new AIConfigManager(env.DB, env);

        // 使用配置管理器获取配置，支持分层配置：DB > 环境变量 > 默认值
        const [apiUrl, apiKey, models, dynamicFallback, healthWindow, switchThreshold,
               streamGateEnabled, streamGateStrictMode, maxToolRounds, maxToolsPerRound] = await Promise.all([
            configManager.get('AI_API_URL'),
            configManager.get('AI_API_KEY'),
            configManager.get('AI_MODELS'),
            configManager.get('AI_DYNAMIC_FALLBACK_ENABLED'),
            configManager.get('AI_MODEL_HEALTH_WINDOW'),
            configManager.get('AI_MODEL_SWITCH_THRESHOLD'),
            configManager.get('AI_STREAM_GATE_ENABLED'),
            configManager.get('AI_STREAM_GATE_STRICT_MODE'),
            configManager.get('AI_MAX_TOOL_ROUNDS'),
            configManager.get('AI_MAX_TOOLS_PER_ROUND'),
        ]);

        // 从env中提取可序列化的配置值，排除DB等对象
        const { DB: _db, ...serializableEnv } = env;
        return {
            ...serializableEnv,
            AI_API_URL: apiUrl || env.AI_API_URL || '',
            AI_API_KEY: apiKey || env.AI_API_KEY || '',
            AI_MODELS: models || env.AI_MODELS || env.AI_MODEL || '',
            AI_MODEL: models?.split(',')[0] || env.AI_MODEL || '',
            AI_DYNAMIC_FALLBACK_ENABLED: String(dynamicFallback !== undefined ? dynamicFallback : env.AI_DYNAMIC_FALLBACK_ENABLED || 'false'),
            AI_MODEL_HEALTH_WINDOW: String(healthWindow !== undefined ? healthWindow : env.AI_MODEL_HEALTH_WINDOW || '20'),
            AI_MODEL_SWITCH_THRESHOLD: String(switchThreshold !== undefined ? switchThreshold : env.AI_MODEL_SWITCH_THRESHOLD || '5'),
            AI_STREAM_GATE_ENABLED: String(streamGateEnabled !== undefined ? streamGateEnabled : env.AI_STREAM_GATE_ENABLED || 'true'),
            AI_STREAM_GATE_STRICT_MODE: String(streamGateStrictMode !== undefined ? streamGateStrictMode : env.AI_STREAM_GATE_STRICT_MODE || 'false'),
            // 将新配置注入到环境变量中供其他模块使用
            AI_MAX_TOOL_ROUNDS: maxToolRounds !== undefined ? maxToolRounds : (env.AI_MAX_TOOL_ROUNDS ? parseInt(env.AI_MAX_TOOL_ROUNDS) : 3),
            AI_MAX_TOOLS_PER_ROUND: maxToolsPerRound !== undefined ? maxToolsPerRound : (env.AI_MAX_TOOLS_PER_ROUND ? parseInt(env.AI_MAX_TOOLS_PER_ROUND) : 8),
        };
    } catch (error) {
        console.warn('[AI] Failed to load runtime AI settings from DB, fallback to env:', error?.message);
        // 返回原始env（排除DB对象），但确保包含默认配置值
        const { DB: _db, ...serializableEnv } = env;
        return {
            ...serializableEnv,
            AI_MAX_TOOL_ROUNDS: env.AI_MAX_TOOL_ROUNDS ? parseInt(env.AI_MAX_TOOL_ROUNDS) : 3,
            AI_MAX_TOOLS_PER_ROUND: env.AI_MAX_TOOLS_PER_ROUND ? parseInt(env.AI_MAX_TOOLS_PER_ROUND) : 8,
        };
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
    const body = c.get('aiRequestBody') || await c.req.json();
    const { messages: history, context: clientContext = {} } = body;
    const requestContext = createAIRequestContext({
        userId: c.get('user')?.id || null,
        routeType: 'chat',
        signal: c.req.raw.signal,
    });
    const telemetryWriter = createTelemetryWriter(env);
    const runtimeEnv = {
        ...(await resolveAIRuntimeEnv(env)),
        AI_REQUEST_SIGNAL: requestContext.signal,
    };
    const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const prepared = await prepareConversationRequest({
        history,
        runtimeEnv,
        channel: 'chat',
        basePrompt: SYSTEM_PROMPT(todayDate, clientContext),
    });
    const { visionFirst, latestUserText, messages, telemetry } = prepared;
    const inputSummary = telemetry.inputSummary;
    const userSignals = telemetry.userSignals;
    const requestId = createRequestId();
    requestContext.addSpan(createAISpanRecord({ spanType: 'request_start', status: 'started', detail: { routeType: 'chat' } }));
    logInjectionTelemetry('chat.user_input', userSignals);
    console.info('[AI Chat][InputModalities]', JSON.stringify(inputSummary));
    const safetyCheck = validateAIRequest({
        history,
        limits: {
            maxInputLength: Number(runtimeEnv.AI_MAX_INPUT_LENGTH || 10000),
            maxImageCount: 4,
            maxImageUrlLength: Number(runtimeEnv.AI_MAX_IMAGE_SIZE || 5000000),
        },
        userSignals,
    });
    if (safetyCheck.decision === 'block') {
        return c.json({ success: false, error: safetyCheck.reason }, 400);
    }

    const actionService = createAIActionService();
    const actionHandle = await actionService.handleTurn({
        text: latestUserText,
        context: clientContext,
        user: c.get('user'),
        actionContext: {
            c,
            env,
            user: c.get('user'),
            createManagedOrder,
            createManagedProduct,
            repos: {
                productRepo: new ProductRepository(env.DB),
                variantRepo: new ProductVariantRepository(env.DB),
            },
        },
    });
    if (actionHandle.handled) {
        console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
            requestId,
            userId: c.get('user')?.id || null,
            sessionId: actionHandle.actionResult?.payload?.sessionId || null,
            routeType: 'chat',
            visionFirst,
            retryCount: 0,
            cancellationReason: requestContext.getAbortReason(),
            actionKind: actionHandle.actionResult?.kind || null,
            entityType: actionHandle.actionResult?.payload?.entityType || null,
            finalStatus: 'action_handled',
        })));
        await telemetryWriter.writeAll({
            trace: createAITraceRecord({
                requestId,
                traceId: requestContext.traceId,
                userId: c.get('user')?.id || null,
                routeType: 'chat',
                quotaDecision: c.get('aiQuotaDecision')?.reason || 'allowed',
                finalStatus: 'action_handled',
            }),
            spans: requestContext.getSpans(),
            usageDaily: createAIUsageDailyRecord({
                userId: c.get('user')?.id || 'anonymous',
                requestCount: 1,
                estimatedTokens: estimateUsageTokens(history),
            }),
        });
        return success({
            message: {
                role: 'assistant',
                content: actionHandle.actionResult.payload?.successMessage || actionHandle.actionResult.kind,
                action: actionHandle.actionResult,
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

        let response = await callAI(messages, (visionFirst || safetyCheck.disableTools) ? [] : AI_TOOLS, runtimeEnv);
        requestContext.addSpan(createAISpanRecord({
            requestId,
            spanType: 'provider_call',
            status: 'completed',
            detail: { phase: 'initial', model: response?._meta?.model || null },
        }));
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
                const args = parseJsonObject(toolCall.function.arguments, {});
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
            requestContext.addSpan(createAISpanRecord({
                requestId,
                spanType: 'provider_call',
                status: 'completed',
                detail: { phase: 'post_tool', model: response?._meta?.model || null },
            }));
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

        console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
            requestId,
            userId: c.get('user')?.id || null,
            routeType: 'chat',
            visionFirst,
            selectedModel: response?._meta?.model || null,
            modelSwitched: Boolean(response?._meta?.switched),
            retryCount: Number(response?._meta?.retryCount || 0),
            cancellationReason: requestContext.getAbortReason(),
            finalStatus: 'completed',
        })));
        await telemetryWriter.writeAll({
            trace: createAITraceRecord({
                requestId,
                traceId: requestContext.traceId,
                userId: c.get('user')?.id || null,
                routeType: 'chat',
                selectedModel: response?._meta?.model || null,
                retryCount: Number(response?._meta?.retryCount || 0),
                quotaDecision: c.get('aiQuotaDecision')?.reason || 'allowed',
                cancellationReason: requestContext.getAbortReason(),
                finalStatus: 'completed',
            }),
            spans: requestContext.getSpans(),
            usageDaily: createAIUsageDailyRecord({
                userId: c.get('user')?.id || 'anonymous',
                requestCount: 1,
                estimatedTokens: estimateUsageTokens(history),
            }),
        });
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
    const body = c.get('aiRequestBody') || await c.req.json();
    const { messages: history, context: clientContext = {} } = body;
    const requestContext = createAIRequestContext({
        userId: c.get('user')?.id || null,
        routeType: 'stream',
        signal: c.req.raw.signal,
    });
    const telemetryWriter = createTelemetryWriter(env);
    const runtimeEnv = {
        ...(await resolveAIRuntimeEnv(env)),
        AI_REQUEST_SIGNAL: requestContext.signal,
    };
    const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const prepared = await prepareConversationRequest({
        history,
        runtimeEnv,
        channel: 'stream',
        basePrompt: SYSTEM_PROMPT(todayDate, clientContext),
    });
    const { visionFirst, latestUserText, telemetry } = prepared;
    const inputSummary = telemetry.inputSummary;
    const userSignals = telemetry.userSignals;
    const requestId = createRequestId();
    requestContext.addSpan(createAISpanRecord({ requestId, spanType: 'request_start', status: 'started', detail: { routeType: 'stream' } }));
    logInjectionTelemetry('stream.user_input', userSignals);
    console.info('[AI Stream][InputModalities]', JSON.stringify(inputSummary));
    const safetyCheck = validateAIRequest({
        history,
        limits: {
            maxInputLength: Number(runtimeEnv.AI_MAX_INPUT_LENGTH || 10000),
            maxImageCount: 4,
            maxImageUrlLength: Number(runtimeEnv.AI_MAX_IMAGE_SIZE || 5000000),
        },
        userSignals,
    });
    if (safetyCheck.decision === 'block') {
        return c.json({ success: false, error: safetyCheck.reason }, 400);
    }

    const actionService = createAIActionService();
    const actionHandle = await actionService.handleTurn({
        text: latestUserText,
        context: clientContext,
        user: c.get('user'),
        actionContext: {
            c,
            env,
            user: c.get('user'),
            createManagedOrder,
            createManagedProduct,
            repos: {
                productRepo: new ProductRepository(env.DB),
                variantRepo: new ProductVariantRepository(env.DB),
            },
        },
    });

    return streamSSE(c, async (stream) => {
        try {
            if (actionHandle.handled) {
                console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
                    requestId,
                    userId: c.get('user')?.id || null,
                    sessionId: actionHandle.actionResult?.payload?.sessionId || null,
                    routeType: 'stream',
                    visionFirst,
                    retryCount: 0,
                    cancellationReason: requestContext.getAbortReason(),
                    actionKind: actionHandle.actionResult?.kind || null,
                    entityType: actionHandle.actionResult?.payload?.entityType || null,
                    finalStatus: 'action_handled',
                })));
                await telemetryWriter.writeAll({
                    trace: createAITraceRecord({
                        requestId,
                        traceId: requestContext.traceId,
                        userId: c.get('user')?.id || null,
                        routeType: 'stream',
                        quotaDecision: c.get('aiQuotaDecision')?.reason || 'allowed',
                        finalStatus: 'action_handled',
                    }),
                    spans: requestContext.getSpans(),
                    usageDaily: createAIUsageDailyRecord({
                        userId: c.get('user')?.id || 'anonymous',
                        requestCount: 1,
                        estimatedTokens: estimateUsageTokens(history),
                    }),
                });
                await stream.writeSSE({
                    event: actionHandle.event.type,
                    data: JSON.stringify(actionHandle.event.data || {}),
                });
                if (actionHandle.refreshEvent) {
                    await stream.writeSSE({
                        event: actionHandle.refreshEvent.type,
                        data: JSON.stringify(actionHandle.refreshEvent.data || {}),
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

            let messages = [...prepared.messages];

            const streamResult = await callAIStream(messages, (visionFirst || safetyCheck.disableTools) ? [] : AI_TOOLS, runtimeEnv);
            requestContext.addSpan(createAISpanRecord({
                requestId,
                spanType: 'provider_call',
                status: 'completed',
                detail: { phase: 'initial', model: streamResult.model || null, retryCount: streamResult.retryCount || 0 },
            }));
            logModelUsageTelemetry('Stream', {
                runtimeEnv,
                selectedModel: streamResult.model,
                switched: streamResult.switched,
                visionFirst,
                toolsEnabled: !visionFirst && Array.isArray(AI_TOOLS) && AI_TOOLS.length > 0,
                phase: 'initial',
            });

            const gateEnabled = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_ENABLED, true);
            const strictMode = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_STRICT_MODE, false);
            const engineResult = await runAIStreamEngine({
                initialResult: streamResult,
                initialMessages: messages,
                runtimeEnv,
                tools: AI_TOOLS,
                callAIStream,
                parseSSEChunk,
                emit: async (event) => {
                    await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data || {}) });
                },
                executeTool,
                maxToolRounds: runtimeEnv.AI_MAX_TOOL_ROUNDS ?? 3,
                maxToolsPerRound: runtimeEnv.AI_MAX_TOOLS_PER_ROUND ?? 8,
                streamOptions: { gateEnabled, strictMode },
                requestContext,
            });
            const { initialParsed } = engineResult;
            const { fullContent, toolCalls } = initialParsed;
            const roundTelemetry = engineResult.roundTelemetry;
            if (String(fullContent || '').includes('[IMAGE_UNSUPPORTED]')) {
                console.warn('[AI Stream][ImageUnsupportedResponse]', JSON.stringify({
                    selectedModel: streamResult.model || null,
                    switched: Boolean(streamResult.switched),
                    visionFirst,
                    inputSummary,
                    phase: 'initial',
                }));
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

            console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
                requestId,
                userId: c.get('user')?.id || null,
                routeType: 'stream',
                visionFirst,
                selectedModel: streamResult.model || null,
                modelSwitched: Boolean(streamResult.switched),
                retryCount: Number(streamResult.retryCount || 0),
                toolRounds: roundTelemetry.rounds || 0,
                executedTools: roundTelemetry.executedTools > 0 ? ['tool_execution'] : [],
                cancellationReason: requestContext.getAbortReason(),
                finalStatus: 'completed',
            })));
            await telemetryWriter.writeAll({
                trace: createAITraceRecord({
                    requestId,
                    traceId: requestContext.traceId,
                    userId: c.get('user')?.id || null,
                    routeType: 'stream',
                    selectedModel: streamResult.model || null,
                    retryCount: Number(streamResult.retryCount || 0),
                    toolRounds: roundTelemetry.rounds || 0,
                    quotaDecision: c.get('aiQuotaDecision')?.reason || 'allowed',
                    cancellationReason: requestContext.getAbortReason(),
                    finalStatus: 'completed',
                }),
                spans: requestContext.getSpans(),
                usageDaily: createAIUsageDailyRecord({
                    userId: c.get('user')?.id || 'anonymous',
                    requestCount: 1,
                    estimatedTokens: estimateUsageTokens(history),
                }),
            });
            await stream.writeSSE({ event: 'done', data: '{}' });
        } catch (err) {
            console.error('[AI Hono Stream] Error:', err);
            console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
                requestId,
                userId: c.get('user')?.id || null,
                routeType: 'stream',
                visionFirst,
                retryCount: 0,
                cancellationReason: requestContext.getAbortReason(),
                finalStatus: 'failed',
            })));
            await telemetryWriter.writeAll({
                trace: createAITraceRecord({
                    requestId,
                    traceId: requestContext.traceId,
                    userId: c.get('user')?.id || null,
                    routeType: 'stream',
                    quotaDecision: c.get('aiQuotaDecision')?.reason || 'allowed',
                    cancellationReason: requestContext.getAbortReason(),
                    finalStatus: 'failed',
                }),
                spans: requestContext.getSpans(),
                usageDaily: createAIUsageDailyRecord({
                    userId: c.get('user')?.id || 'anonymous',
                    requestCount: 1,
                    estimatedTokens: estimateUsageTokens(history),
                }),
            });
            await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: err.message }) });
        }
    });
});

export default app;
