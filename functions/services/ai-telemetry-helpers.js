/**
 * AI Telemetry 辅助函数
 * 从 AIService 中提取的 telemetry 相关工具函数
 * @module services/ai-telemetry-helpers
 */

import { parseBooleanFlag } from '../ai/config-schema.js';
import { generateId } from '../api/utils/id.js';

export { parseBooleanFlag, generateId as createRequestId };

/**
 * 解析模型列表用于日志
 * @param {string} [modelsValue='']
 * @returns {string[]}
 */
export function parseModelListForLog(modelsValue = '') {
  return String(modelsValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 记录模型使用 telemetry
 * @param {string} channel - 通道名称
 * @param {Object} options - 选项
 */
export function logModelUsageTelemetry(channel, {
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

/**
 * 记录注入检测 telemetry
 * @param {string} channel - 通道名称
 * @param {Array} entries - 检测到的注入信号
 */
export function logInjectionTelemetry(channel, entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  console.warn('[AI PromptInjection][Detected]', JSON.stringify({
    channel,
    count: entries.length,
    entries: entries.slice(0, 6),
  }));
}

/**
 * 估算 token 使用量（区分中英文字符）
 *
 * 中文字符在常见 tokenizer 中通常占 2-3 个 token，英文约 4 字符/token。
 * 使用 CJK 区间 U+4E00..U+9FFF 做近似匹配。
 *
 * @param {Array} [history=[]]
 * @returns {number}
 */
export function estimateUsageTokens(history = []) {
  const raw = JSON.stringify(history || []);
  const cjkCount = (raw.match(/[一-鿿]/g) || []).length;
  const otherCount = raw.length - cjkCount;
  return Math.max(1, Math.ceil(cjkCount * 2.5 + otherCount / 4));
}
