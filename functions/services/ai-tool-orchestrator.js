/**
 * AI 工具编排器
 * 封装工具调用循环和工具执行逻辑，从 AIService 中提取
 * @module services/ai-tool-orchestrator
 */

import { parseJsonObject } from '../api/utils/json.js';
import { executeAITool } from '../utils/ai-tool-executor.js';
import { detectInjectionSignals } from '../ai/conversation-service.js';
import { logInjectionTelemetry } from './ai-telemetry-helpers.js';

/**
 * 执行工具调用循环（chat 模式）
 * @param {Array} messages - 对话消息数组（会被原地修改）
 * @param {Array} toolCalls - 工具调用列表
 * @param {Object} repos - 仓库实例集合
 */
export async function executeToolCalls(messages, toolCalls, repos) {
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const args = parseJsonObject(toolCall.function.arguments, {});
    const result = await executeAITool(functionName, args, repos);
    logInjectionTelemetry(
      `chat.tool_result.${functionName}`,
      detectInjectionSignals(JSON.stringify(result))
    );
    messages.push({
      tool_call_id: toolCall.id,
      role: 'tool',
      name: functionName,
      content: JSON.stringify(result),
    });
  }
}

/**
 * 创建流式工具执行器
 * @param {Object} repos - 仓库实例集合
 * @returns {Function} 工具执行函数
 */
export function createStreamToolExecutor(repos) {
  return async (name, args) => {
    const result = await executeAITool(name, args, repos);
    logInjectionTelemetry(
      `stream.tool_result.${name}`,
      detectInjectionSignals(JSON.stringify(result))
    );
    return result;
  };
}
