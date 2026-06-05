/**
 * AI 聊天核心业务服务
 * 封装 /chat 和 /stream 端点的核心流程，包括工具执行、telemetry 记录等
 * @module services/AIService
 */

import { AI_TOOLS } from '../api/utils/ai-prompts.js';
import { OrderStatsRepository } from '../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../repositories/SystemStatsRepository.js';
import { OrderRepository } from '../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../repositories/OrderTimelineRepository.js';
import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { CustomerRepository } from '../repositories/CustomerRepository.ts';
import { GoodsOverviewRepository } from '../repositories/GoodsOverviewRepository.js';
import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository.js';
import { callAIStream, callAI, parseSSEChunk } from '../utils/ai-utils.js';
import { detectInjectionSignals } from '../ai/conversation-service.js';
import { runAIStreamEngine } from '../ai/stream-engine.js';
import { createAIActionService } from '../ai/action-service.js';
import { createAIRequestTelemetry, createAISpanRecord, createAITraceRecord, createAIUsageDailyRecord } from '../ai/telemetry.js';
import { createManagedOrder } from '../lib/hono/routes/manage/orders/create-order.js';
import { createManagedProduct } from '../lib/hono/routes/manage/products/create-product.js';
import { executeToolCalls, createStreamToolExecutor } from './ai-tool-orchestrator.js';
import { prepareAIRequest } from './ai-request-preparer.js';
import {
  parseBooleanFlag,
  logModelUsageTelemetry,
  logInjectionTelemetry,
  estimateUsageTokens,
} from './ai-telemetry-helpers.js';

export class AIService {
  constructor(db, deps = {}) {
    this.db = db;
    this.repos = {
      orderStatsRepo: deps.orderStatsRepo || new OrderStatsRepository(db),
      systemStatsRepo: deps.systemStatsRepo || new SystemStatsRepository(db),
      orderRepo: deps.orderRepo || new OrderRepository(db),
      orderTimelineRepo: deps.orderTimelineRepo || new OrderTimelineRepository(db),
      productRepo: deps.productRepo || new ProductRepository(db),
      variantRepo: deps.variantRepo || new ProductVariantRepository(db),
      customerRepo: deps.customerRepo || new CustomerRepository(db),
      goodsOverviewRepo: deps.goodsOverviewRepo || new GoodsOverviewRepository(db),
      purchaseOrderRepo: deps.purchaseOrderRepo || new PurchaseOrderRepository(db),
    };
  }

  /** @private 尝试处理 action */
  async _tryHandleAction({ latestUserText, clientContext, user, c, runtimeEnv }) {
    const actionService = createAIActionService();
    return actionService.handleTurn({
      text: latestUserText, context: clientContext, user,
      actionContext: {
        c, env: { ...runtimeEnv, DB: this.db }, user, createManagedOrder, createManagedProduct,
        repos: { productRepo: this.repos.productRepo, variantRepo: this.repos.variantRepo },
      },
    });
  }

  /** @private 写入 telemetry 数据 */
  async _writeTelemetry({ telemetryWriter, requestContext, requestId, user, routeType, history, quotaDecision, extra = {} }) {
    await telemetryWriter.writeAll({
      trace: createAITraceRecord({
        requestId, traceId: requestContext.traceId, userId: user?.id || null,
        routeType, quotaDecision: quotaDecision?.reason || 'allowed', ...extra,
      }),
      spans: requestContext.getSpans(),
      usageDaily: createAIUsageDailyRecord({
        userId: user?.id || 'anonymous', requestCount: 1,
        estimatedTokens: estimateUsageTokens(history),
      }),
    });
  }

  /** @private 记录 action 处理的 telemetry */
  async _logActionHandled({ requestId, user, routeType, visionFirst, requestContext, actionHandle, history, quotaDecision, telemetryWriter }) {
    console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
      requestId, userId: user?.id || null,
      sessionId: actionHandle.actionResult?.payload?.sessionId || null,
      routeType, visionFirst, retryCount: 0,
      cancellationReason: requestContext.getAbortReason(),
      actionKind: actionHandle.actionResult?.kind || null,
      entityType: actionHandle.actionResult?.payload?.entityType || null,
      finalStatus: 'action_handled',
    })));
    await this._writeTelemetry({
      telemetryWriter, requestContext, requestId, user, routeType, history, quotaDecision,
      extra: { finalStatus: 'action_handled' },
    });
  }

  /**
   * 处理非流式聊天请求
   * @param {Object} params - 请求参数
   * @returns {Promise<Object>} 响应结果
   */
  async handleChat({ body, runtimeEnv, user, c, quotaDecision }) {
    const ctx = await prepareAIRequest({ body, runtimeEnv, user, c, routeType: 'chat', db: this.db });
    const { history, requestContext, telemetryWriter, envWithSignal, visionFirst, messages, inputSummary, userSignals, requestId, safetyCheck } = ctx;

    logInjectionTelemetry('chat.user_input', userSignals);
    console.info('[AI Chat][InputModalities]', JSON.stringify(inputSummary));
    requestContext.addSpan(createAISpanRecord({ spanType: 'request_start', status: 'started', detail: { routeType: 'chat' } }));

    if (safetyCheck.decision === 'block') {
      return { blocked: true, error: safetyCheck.reason };
    }

    // 尝试处理 action
    const actionHandle = await this._tryHandleAction({
      latestUserText: ctx.latestUserText, clientContext: ctx.clientContext, user, c, runtimeEnv,
    });
    if (actionHandle.handled) {
      await this._logActionHandled({
        requestId, user, routeType: 'chat', visionFirst, requestContext, actionHandle, history, quotaDecision, telemetryWriter,
      });
      return {
        actionHandled: true,
        message: {
          role: 'assistant',
          content: actionHandle.actionResult.payload?.successMessage || actionHandle.actionResult.kind,
          action: actionHandle.actionResult,
        },
      };
    }

    // 常规 AI 调用
    const tools = (visionFirst || safetyCheck.disableTools) ? [] : AI_TOOLS;
    let response = await callAI(messages, tools, envWithSignal);
    requestContext.addSpan(createAISpanRecord({
      requestId, spanType: 'provider_call', status: 'completed',
      detail: { phase: 'initial', model: response?._meta?.model || null },
    }));
    logModelUsageTelemetry('Chat', {
      runtimeEnv: envWithSignal, selectedModel: response?._meta?.model,
      switched: response?._meta?.switched, visionFirst,
      toolsEnabled: !visionFirst && tools.length > 0, phase: 'initial',
    });

    // 工具调用循环
    if (response.choices[0].message.tool_calls) {
      messages.push(response.choices[0].message);
      await executeToolCalls(messages, response.choices[0].message.tool_calls, this.repos);
      response = await callAI(messages, [], envWithSignal);
      requestContext.addSpan(createAISpanRecord({
        requestId, spanType: 'provider_call', status: 'completed',
        detail: { phase: 'post_tool', model: response?._meta?.model || null },
      }));
      logModelUsageTelemetry('Chat', {
        runtimeEnv: envWithSignal, selectedModel: response?._meta?.model,
        switched: response?._meta?.switched, visionFirst, toolsEnabled: false, phase: 'post_tool',
      });
    }

    console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
      requestId, userId: user?.id || null, routeType: 'chat', visionFirst,
      selectedModel: response?._meta?.model || null,
      modelSwitched: Boolean(response?._meta?.switched),
      retryCount: Number(response?._meta?.retryCount || 0),
      cancellationReason: requestContext.getAbortReason(), finalStatus: 'completed',
    })));
    await this._writeTelemetry({
      telemetryWriter, requestContext, requestId, user, routeType: 'chat', history, quotaDecision,
      extra: {
        selectedModel: response?._meta?.model || null,
        retryCount: Number(response?._meta?.retryCount || 0),
        cancellationReason: requestContext.getAbortReason(), finalStatus: 'completed',
      },
    });
    return { message: response.choices[0].message };
  }

  /**
   * 处理流式聊天请求
   * @param {Object} params - 请求参数
   * @returns {Promise<void>}
   */
  async handleStream({ body, runtimeEnv, user, c, quotaDecision, emit }) {
    const ctx = await prepareAIRequest({ body, runtimeEnv, user, c, routeType: 'stream', db: this.db });
    const { history, requestContext, telemetryWriter, envWithSignal, visionFirst, inputSummary, userSignals, requestId, safetyCheck } = ctx;

    logInjectionTelemetry('stream.user_input', userSignals);
    console.info('[AI Stream][InputModalities]', JSON.stringify(inputSummary));
    requestContext.addSpan(createAISpanRecord({ requestId, spanType: 'request_start', status: 'started', detail: { routeType: 'stream' } }));

    if (safetyCheck.decision === 'block') {
      return { blocked: true, error: safetyCheck.reason };
    }

    // 尝试处理 action
    const actionHandle = await this._tryHandleAction({
      latestUserText: ctx.latestUserText, clientContext: ctx.clientContext, user, c, runtimeEnv,
    });
    if (actionHandle.handled) {
      await this._logActionHandled({
        requestId, user, routeType: 'stream', visionFirst, requestContext, actionHandle, history, quotaDecision, telemetryWriter,
      });
      await emit({ type: actionHandle.event.type, data: actionHandle.event.data || {} });
      if (actionHandle.refreshEvent) {
        await emit({ type: actionHandle.refreshEvent.type, data: actionHandle.refreshEvent.data || {} });
      }
      await emit({ type: 'done', data: {} });
      return { actionHandled: true };
    }

    // 常规流式调用
    const executeTool = createStreamToolExecutor(this.repos);
    const tools = (visionFirst || safetyCheck.disableTools) ? [] : AI_TOOLS;
    let messages = [...ctx.messages];
    const streamResult = await callAIStream(messages, tools, envWithSignal);
    requestContext.addSpan(createAISpanRecord({
      requestId, spanType: 'provider_call', status: 'completed',
      detail: { phase: 'initial', model: streamResult.model || null, retryCount: streamResult.retryCount || 0 },
    }));
    logModelUsageTelemetry('Stream', {
      runtimeEnv: envWithSignal, selectedModel: streamResult.model,
      switched: streamResult.switched, visionFirst,
      toolsEnabled: !visionFirst && tools.length > 0, phase: 'initial',
    });

    const gateEnabled = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_ENABLED, true);
    const strictMode = parseBooleanFlag(runtimeEnv.AI_STREAM_GATE_STRICT_MODE, false);
    const engineResult = await runAIStreamEngine({
      initialResult: streamResult, initialMessages: messages, runtimeEnv: envWithSignal,
      tools: AI_TOOLS, callAIStream, parseSSEChunk,
      emit: async (event) => { await emit(event); },
      executeTool,
      maxToolRounds: runtimeEnv.AI_MAX_TOOL_ROUNDS ?? 3,
      maxToolsPerRound: runtimeEnv.AI_MAX_TOOLS_PER_ROUND ?? 8,
      streamOptions: { gateEnabled, strictMode }, requestContext,
    });
    const { initialParsed } = engineResult;
    const { toolCalls } = initialParsed;
    const roundTelemetry = engineResult.roundTelemetry;

    if (gateEnabled) {
      const gateStats = initialParsed.gateStats || {};
      console.info('[AI Stream][GateTelemetry]', JSON.stringify({
        blockedEvents: gateStats.blockedEvents || 0,
        blockedChars: gateStats.blockedChars || 0,
        recoveredEvents: gateStats.recoveredEvents || 0,
        recoveredChars: gateStats.recoveredChars || 0,
        suspectTransitions: gateStats.suspectTransitions || 0,
        toolRounds: roundTelemetry.rounds || 0,
        executedTools: roundTelemetry.executedTools || 0,
        suspectedFalsePositive: gateStats.blockedEvents > 0 && toolCalls.length === 0 && roundTelemetry.executedTools === 0,
      }));
    }

    console.info('[AI RequestTelemetry]', JSON.stringify(createAIRequestTelemetry({
      requestId, userId: user?.id || null, routeType: 'stream', visionFirst,
      selectedModel: streamResult.model || null,
      modelSwitched: Boolean(streamResult.switched),
      retryCount: Number(streamResult.retryCount || 0),
      toolRounds: roundTelemetry.rounds || 0,
      executedTools: roundTelemetry.executedTools > 0 ? ['tool_execution'] : [],
      cancellationReason: requestContext.getAbortReason(), finalStatus: 'completed',
    })));
    await this._writeTelemetry({
      telemetryWriter, requestContext, requestId, user, routeType: 'stream', history, quotaDecision,
      extra: {
        selectedModel: streamResult.model || null,
        retryCount: Number(streamResult.retryCount || 0),
        toolRounds: roundTelemetry.rounds || 0,
        cancellationReason: requestContext.getAbortReason(), finalStatus: 'completed',
      },
    });
    await emit({ type: 'done', data: {} });
    return {};
  }
}

export function createAIService(db, deps = {}) {
  return new AIService(db, deps);
}
