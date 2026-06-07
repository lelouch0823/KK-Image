/**
 * AI 配置解析服务
 * 封装运行时配置解析逻辑，支持分层配置：DB > 环境变量 > 默认值
 * @module services/AIConfigService
 */

import { AIConfigManager } from '../ai/config-manager.js';

export class AIConfigService {
  /**
   * @param {Object} db - D1 数据库实例
   * @param {Object} [env={}] - 环境变量
   * @param {Object} [deps={}] - 依赖注入
   * @param {AIConfigManager} [deps.configManager]
   */
  constructor(db, env = {}, deps = {}) {
    this.db = db;
    this.env = env;
    this.configManager = deps.configManager || new AIConfigManager(db, env);
  }

  /**
   * 解析 AI 运行时配置
   * 合并 DB 配置与环境变量，返回完整的运行时配置对象
   * @returns {Promise<Object>} 运行时配置
   */
  async resolveRuntimeEnv() {
    try {
      const [
        apiUrl,
        apiKey,
        models,
        dynamicFallback,
        healthWindow,
        switchThreshold,
        streamGateEnabled,
        streamGateStrictMode,
        maxToolRounds,
        maxToolsPerRound,
      ] = await Promise.all([
        this.configManager.get('AI_API_URL'),
        this.configManager.get('AI_API_KEY'),
        this.configManager.get('AI_MODELS'),
        this.configManager.get('AI_DYNAMIC_FALLBACK_ENABLED'),
        this.configManager.get('AI_MODEL_HEALTH_WINDOW'),
        this.configManager.get('AI_MODEL_SWITCH_THRESHOLD'),
        this.configManager.get('AI_STREAM_GATE_ENABLED'),
        this.configManager.get('AI_STREAM_GATE_STRICT_MODE'),
        this.configManager.get('AI_MAX_TOOL_ROUNDS'),
        this.configManager.get('AI_MAX_TOOLS_PER_ROUND'),
      ]);

      // 从 env 中提取可序列化的配置值，排除 DB 等对象
      const { DB: _db, ...serializableEnv } = this.env;
      return {
        ...serializableEnv,
        AI_API_URL: apiUrl || this.env.AI_API_URL || '',
        AI_API_KEY: apiKey || this.env.AI_API_KEY || '',
        AI_MODELS: models || this.env.AI_MODELS || this.env.AI_MODEL || '',
        AI_MODEL: models?.split(',')[0] || this.env.AI_MODEL || '',
        AI_DYNAMIC_FALLBACK_ENABLED: String(
          dynamicFallback !== undefined
            ? dynamicFallback
            : this.env.AI_DYNAMIC_FALLBACK_ENABLED || 'false'
        ),
        AI_MODEL_HEALTH_WINDOW: String(
          healthWindow !== undefined ? healthWindow : this.env.AI_MODEL_HEALTH_WINDOW || '20'
        ),
        AI_MODEL_SWITCH_THRESHOLD: String(
          switchThreshold !== undefined
            ? switchThreshold
            : this.env.AI_MODEL_SWITCH_THRESHOLD || '5'
        ),
        AI_STREAM_GATE_ENABLED: String(
          streamGateEnabled !== undefined
            ? streamGateEnabled
            : this.env.AI_STREAM_GATE_ENABLED || 'true'
        ),
        AI_STREAM_GATE_STRICT_MODE: String(
          streamGateStrictMode !== undefined
            ? streamGateStrictMode
            : this.env.AI_STREAM_GATE_STRICT_MODE || 'false'
        ),
        AI_MAX_TOOL_ROUNDS:
          maxToolRounds !== undefined
            ? maxToolRounds
            : this.env.AI_MAX_TOOL_ROUNDS
              ? parseInt(this.env.AI_MAX_TOOL_ROUNDS, 10)
              : 3,
        AI_MAX_TOOLS_PER_ROUND:
          maxToolsPerRound !== undefined
            ? maxToolsPerRound
            : this.env.AI_MAX_TOOLS_PER_ROUND
              ? parseInt(this.env.AI_MAX_TOOLS_PER_ROUND, 10)
              : 8,
      };
    } catch (error) {
      console.warn(
        '[AI] Failed to load runtime AI settings from DB, fallback to env:',
        error?.message
      );
      // 返回原始 env（排除 DB 对象），但确保包含默认配置值
      const { DB: _db, ...serializableEnv } = this.env;
      return {
        ...serializableEnv,
        AI_MAX_TOOL_ROUNDS: this.env.AI_MAX_TOOL_ROUNDS
          ? parseInt(this.env.AI_MAX_TOOL_ROUNDS, 10)
          : 3,
        AI_MAX_TOOLS_PER_ROUND: this.env.AI_MAX_TOOLS_PER_ROUND
          ? parseInt(this.env.AI_MAX_TOOLS_PER_ROUND, 10)
          : 8,
      };
    }
  }
}

/**
 * 创建 AIConfigService 实例（工厂函数）
 * @param {Object} db - D1 数据库实例
 * @param {Object} [env={}] - 环境变量
 * @returns {AIConfigService}
 */
export function createAIConfigService(db, env = {}, deps = {}) {
  return new AIConfigService(db, env, deps);
}
