/**
 * AI 请求准备器
 * 封装请求上下文创建、telemetry writer 初始化、输入验证等逻辑
 * @module services/ai-request-preparer
 */

import { SYSTEM_PROMPT } from '../utils/ai-utils.js';
import { prepareConversationRequest } from '../ai/conversation-service.js';
import { createAIRequestContext } from '../ai/request-context.js';
import { createAITelemetryWriter } from '../ai/telemetry-writer.js';
import { validateAIRequest } from '../ai/input-validator.js';
import { createRequestId } from './ai-telemetry-helpers.js';

/**
 * 准备 AI 请求上下文
 * @param {Object} params
 * @param {Object} params.body - 请求体
 * @param {Object} params.runtimeEnv - 运行时环境
 * @param {Object} params.user - 当前用户
 * @param {Object} params.c - Hono 上下文
 * @param {string} params.routeType - 路由类型 ('chat' | 'stream')
 * @param {D1Database} params.db - 数据库实例
 * @returns {Promise<Object>} 请求上下文对象
 */
export async function prepareAIRequest({ body, runtimeEnv, user, c, routeType, db }) {
  const { messages: history, context: clientContext = {} } = body;
  const requestContext = createAIRequestContext({
    userId: user?.id || null, routeType, signal: c.req.raw.signal,
  });
  const telemetryWriter = createAITelemetryWriter({ db });
  const envWithSignal = { ...runtimeEnv, AI_REQUEST_SIGNAL: requestContext.signal };
  const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const prepared = await prepareConversationRequest({
    history, runtimeEnv: envWithSignal, channel: routeType,
    basePrompt: SYSTEM_PROMPT(todayDate, clientContext),
  });
  const { visionFirst, latestUserText, messages, telemetry } = prepared;
  const requestId = createRequestId();
  const safetyCheck = validateAIRequest({
    history,
    limits: {
      maxInputLength: Number(runtimeEnv.AI_MAX_INPUT_LENGTH || 10000),
      maxImageCount: 4,
      maxImageUrlLength: Number(runtimeEnv.AI_MAX_IMAGE_SIZE || 5000000),
    },
    userSignals: telemetry.userSignals,
  });
  return {
    history, clientContext, requestContext, telemetryWriter, envWithSignal,
    visionFirst, latestUserText, messages, inputSummary: telemetry.inputSummary,
    userSignals: telemetry.userSignals, requestId, safetyCheck,
  };
}
