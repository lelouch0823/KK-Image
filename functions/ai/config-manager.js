import { SettingsRepository } from '../repositories/SettingsRepository.js';
import {
  AIConfigKeyMap,
  getDefaultValue,
  validateConfigValue,
  parseBooleanFlag,
  parseNumberValue,
  parseModelList,
} from './config-schema.js';

/**
 * AI配置管理器
 * 支持动态配置热加载和分层配置（环境变量 < DB配置 < 代码默认）
 */
export class AIConfigManager {
  constructor(db, env = {}, options = {}) {
    // 支持依赖注入，便于测试
    this.settingsRepo = options.settingsRepo || new SettingsRepository(db);
    this.env = env;
    this.cache = new Map();
    this.cacheExpiry = options.cacheExpiry || 30000; // 30秒缓存
  }

  /**
   * 获取单个配置项
   * @param {string} dbKey - 数据库中的配置键名，如 'AI_MAX_TOOL_ROUNDS'
   * @returns {Promise<any>} 配置值
   */
  async get(dbKey) {
    const cached = this.cache.get(dbKey);
    if (cached && Date.now() - cached.ts < this.cacheExpiry) {
      return cached.value;
    }

    const path = AIConfigKeyMap[dbKey];
    if (!path) {
      console.warn(`[AIConfigManager] Unknown config key: ${dbKey}`);
      return undefined;
    }

    // 读取优先级: DB配置 > 环境变量 > 默认值
    const dbValue = await this._getFromDB(dbKey);
    const envValue = this.env[dbKey];
    const defaultValue = getDefaultValue(path);

    let value = dbValue ?? envValue ?? defaultValue;

    // 类型转换
    value = this._coerceValue(path, value);

    this.cache.set(dbKey, { value, ts: Date.now() });
    return value;
  }

  /**
   * 批量获取配置项
   * @param {string[]} dbKeys - 配置键名数组
   * @returns {Promise<Object>} 配置对象
   */
  async getMany(dbKeys) {
    const result = {};
    await Promise.all(
      dbKeys.map(async (key) => {
        result[key] = await this.get(key);
      })
    );
    return result;
  }

  /**
   * 获取完整配置对象
   * @returns {Promise<Object>} 完整的配置对象
   */
  async getFullConfig() {
    const allKeys = Object.keys(AIConfigKeyMap);
    const keyValues = await this.getMany(allKeys);

    // 构建嵌套配置对象
    const config = {
      models: {
        primary: keyValues.AI_MODEL || '',
        fallback: parseModelList(keyValues.AI_MODELS),
        healthWindow: keyValues.AI_MODEL_HEALTH_WINDOW,
        switchThreshold: keyValues.AI_MODEL_SWITCH_THRESHOLD,
      },
      rateLimit: {
        enabled: keyValues.AI_RATE_LIMIT_ENABLED,
        requestsPerMinute: keyValues.AI_RATE_LIMIT_RPM,
        tokensPerDay: keyValues.AI_RATE_LIMIT_TPD,
      },
      streaming: {
        gateEnabled: keyValues.AI_STREAM_GATE_ENABLED,
        strictMode: keyValues.AI_STREAM_GATE_STRICT_MODE,
        maxToolRounds: keyValues.AI_MAX_TOOL_ROUNDS,
        maxToolsPerRound: keyValues.AI_MAX_TOOLS_PER_ROUND,
        lookahead: keyValues.AI_STREAM_LOOKAHEAD,
        suspectWindow: keyValues.AI_STREAM_SUSPECT_WINDOW,
      },
      security: {
        maxInputLength: keyValues.AI_MAX_INPUT_LENGTH,
        maxImageSize: keyValues.AI_MAX_IMAGE_SIZE,
        enablePromptInjectionCheck: keyValues.AI_ENABLE_PROMPT_INJECTION_CHECK,
        enableDataMasking: keyValues.AI_ENABLE_DATA_MASKING,
      },
      retry: {
        maxRetries: keyValues.AI_RETRY_MAX_RETRIES,
        backoffMultiplier: keyValues.AI_RETRY_BACKOFF_MULTIPLIER,
        baseDelayMs: keyValues.AI_RETRY_BASE_DELAY_MS,
        maxDelayMs: keyValues.AI_RETRY_MAX_DELAY_MS,
        enableJitter: keyValues.AI_RETRY_ENABLE_JITTER,
      },
      telemetry: {
        enabled: keyValues.AI_TELEMETRY_ENABLED,
        sampleRate: keyValues.AI_TELEMETRY_SAMPLE_RATE,
        includeTokenUsage: keyValues.AI_TELEMETRY_INCLUDE_TOKEN_USAGE,
      },
    };

    return config;
  }

  /**
   * 设置配置值
   * @param {string} dbKey - 配置键名
   * @param {any} value - 配置值
   * @param {Object} options - 选项
   * @param {string} options.description - 配置描述
   * @returns {Promise<boolean>} 是否成功
   */
  async set(dbKey, value, options = {}) {
    const path = AIConfigKeyMap[dbKey];
    if (!path) {
      throw new Error(`Unknown config key: ${dbKey}`);
    }

    // 验证值
    const validation = validateConfigValue(path, value);
    if (!validation.valid) {
      throw new Error(`Invalid value for ${dbKey}: ${validation.error}`);
    }

    // 保存到DB
    await this.settingsRepo.upsert(dbKey, {
      value: String(value),
      category: 'ai',
      description: options.description || '',
    });

    // 使缓存失效
    this.cache.delete(dbKey);

    return true;
  }

  /**
   * 批量设置配置
   * @param {Array<{key: string, value: any, description?: string}>} settings
   * @returns {Promise<boolean>}
   */
  async setMany(settings) {
    const dbSettings = settings.map((s) => {
      const path = AIConfigKeyMap[s.key];
      if (!path) {
        throw new Error(`Unknown config key: ${s.key}`);
      }

      const validation = validateConfigValue(path, s.value);
      if (!validation.valid) {
        throw new Error(`Invalid value for ${s.key}: ${validation.error}`);
      }

      return {
        key: s.key,
        value: String(s.value),
        category: 'ai',
        description: s.description || '',
      };
    });

    await this.settingsRepo.batchUpsert(dbSettings);

    // 使所有相关缓存失效
    settings.forEach((s) => this.cache.delete(s.key));

    return true;
  }

  /**
   * 使配置缓存失效
   * @param {string|string[]} dbKeys - 要失效的键，不传则全部失效
   */
  invalidateCache(dbKeys) {
    if (!dbKeys) {
      this.cache.clear();
      return;
    }

    const keys = Array.isArray(dbKeys) ? dbKeys : [dbKeys];
    keys.forEach((key) => this.cache.delete(key));
  }

  /**
   * 从数据库获取配置值
   * @private
   */
  async _getFromDB(dbKey) {
    try {
      const setting = await this.settingsRepo.get(dbKey, 'ai');
      return setting?.value;
    } catch (err) {
      console.warn(`[AIConfigManager] Failed to get ${dbKey} from DB:`, err.message);
      return undefined;
    }
  }

  /**
   * 根据路径类型强制转换值
   * @private
   */
  _coerceValue(path, value) {
    const parts = path.split('.');
    const lastPart = parts[parts.length - 1];

    // 根据键名后缀推断类型
    if (lastPart.startsWith('enable') || lastPart === 'enabled' || lastPart.includes('Jitter')) {
      return parseBooleanFlag(value);
    }

    if (
      lastPart.includes('Window') ||
      lastPart.includes('Threshold') ||
      lastPart.includes('Rounds') ||
      lastPart.includes('Per') ||
      lastPart.includes('Length') ||
      lastPart.includes('Size') ||
      lastPart.includes('Retries') ||
      lastPart.includes('Delay') ||
      lastPart.includes('lookahead') ||
      lastPart.includes('Window')
    ) {
      return parseNumberValue(value);
    }

    if (lastPart === 'sampleRate') {
      const parsed = parseNumberValue(value, 1.0);
      return Math.min(1, Math.max(0, parsed));
    }

    if (lastPart === 'fallback' || lastPart === 'models') {
      return parseModelList(value);
    }

    return value;
  }
}
