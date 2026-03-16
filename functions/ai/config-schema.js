/**
 * AI配置Schema定义
 * 定义所有AI模块可配置的参数及其校验规则
 */

export const AIConfigSchema = {
  // API配置
  api: {
    url: { type: 'string', default: '' },
    key: { type: 'string', default: '' },
  },

  // 模型配置
  models: {
    primary: { type: 'string', default: '' },
    fallback: { type: 'array', itemType: 'string', default: [] },
    healthWindow: { type: 'number', min: 5, max: 200, default: 20 },
    switchThreshold: { type: 'number', min: 1, max: 100, default: 5 },
  },

  // 限流配置
  rateLimit: {
    enabled: { type: 'boolean', default: true },
    requestsPerMinute: { type: 'number', min: 1, max: 1000, default: 60 },
    tokensPerDay: { type: 'number', min: 1000, default: 100000 },
    imageRequestsPerMinute: { type: 'number', min: 1, max: 1000, default: 20 },
  },

  // 流式配置
  streaming: {
    gateEnabled: { type: 'boolean', default: true },
    strictMode: { type: 'boolean', default: false },
    maxToolRounds: { type: 'number', min: 1, max: 10, default: 3 },
    maxToolsPerRound: { type: 'number', min: 1, max: 20, default: 8 },
    lookahead: { type: 'number', min: 20, max: 200, default: 80 },
    suspectWindow: { type: 'number', min: 100, max: 500, default: 220 },
  },

  // 安全配置
  security: {
    maxInputLength: { type: 'number', min: 100, default: 10000 },
    maxImageSize: { type: 'number', min: 100000, default: 5000000 }, // 5MB
    enablePromptInjectionCheck: { type: 'boolean', default: true },
    enableDataMasking: { type: 'boolean', default: true },
  },

  // 重试配置
  retry: {
    maxRetries: { type: 'number', min: 0, max: 5, default: 3 },
    backoffMultiplier: { type: 'number', min: 1, max: 3, default: 2 },
    baseDelayMs: { type: 'number', min: 100, default: 1000 },
    maxDelayMs: { type: 'number', min: 1000, default: 30000 },
    enableJitter: { type: 'boolean', default: true },
  },

  // 遥测配置
  telemetry: {
    enabled: { type: 'boolean', default: true },
    sampleRate: { type: 'number', min: 0, max: 1, default: 1.0 },
    includeTokenUsage: { type: 'boolean', default: true },
  },

  rollout: {
    quotasEnabled: { type: 'boolean', default: true },
    observabilityV2Enabled: { type: 'boolean', default: true },
    safetyEnforcementEnabled: { type: 'boolean', default: true },
  },
};

/**
 * 配置键名映射（DB key -> 配置路径）
 */
export const AIConfigKeyMap = {
  // API凭证
  AI_API_URL: 'api.url',
  AI_API_KEY: 'api.key',

  // 模型相关
  AI_MODEL: 'models.primary',
  AI_MODELS: 'models.fallback',
  AI_MODEL_HEALTH_WINDOW: 'models.healthWindow',
  AI_MODEL_SWITCH_THRESHOLD: 'models.switchThreshold',

  // 限流相关
  AI_RATE_LIMIT_ENABLED: 'rateLimit.enabled',
  AI_RATE_LIMIT_RPM: 'rateLimit.requestsPerMinute',
  AI_RATE_LIMIT_TPD: 'rateLimit.tokensPerDay',
  AI_RATE_LIMIT_IMAGE_RPM: 'rateLimit.imageRequestsPerMinute',

  // 流式相关
  AI_STREAM_GATE_ENABLED: 'streaming.gateEnabled',
  AI_STREAM_GATE_STRICT_MODE: 'streaming.strictMode',
  AI_MAX_TOOL_ROUNDS: 'streaming.maxToolRounds',
  AI_MAX_TOOLS_PER_ROUND: 'streaming.maxToolsPerRound',
  AI_STREAM_LOOKAHEAD: 'streaming.lookahead',
  AI_STREAM_SUSPECT_WINDOW: 'streaming.suspectWindow',

  // 安全相关
  AI_MAX_INPUT_LENGTH: 'security.maxInputLength',
  AI_MAX_IMAGE_SIZE: 'security.maxImageSize',
  AI_ENABLE_PROMPT_INJECTION_CHECK: 'security.enablePromptInjectionCheck',
  AI_ENABLE_DATA_MASKING: 'security.enableDataMasking',

  // 重试相关
  AI_RETRY_MAX_RETRIES: 'retry.maxRetries',
  AI_RETRY_BACKOFF_MULTIPLIER: 'retry.backoffMultiplier',
  AI_RETRY_BASE_DELAY_MS: 'retry.baseDelayMs',
  AI_RETRY_MAX_DELAY_MS: 'retry.maxDelayMs',
  AI_RETRY_ENABLE_JITTER: 'retry.enableJitter',

  // 遥测相关
  AI_TELEMETRY_ENABLED: 'telemetry.enabled',
  AI_TELEMETRY_SAMPLE_RATE: 'telemetry.sampleRate',
  AI_TELEMETRY_INCLUDE_TOKEN_USAGE: 'telemetry.includeTokenUsage',

  AI_ROLLOUT_QUOTAS_ENABLED: 'rollout.quotasEnabled',
  AI_ROLLOUT_OBSERVABILITY_V2_ENABLED: 'rollout.observabilityV2Enabled',
  AI_ROLLOUT_SAFETY_ENFORCEMENT_ENABLED: 'rollout.safetyEnforcementEnabled',
};

/**
 * 根据配置路径获取默认值
 * @param {string} path - 点分隔的配置路径，如 'models.healthWindow'
 * @returns {any} 默认值
 */
export function getDefaultValue(path) {
  const parts = path.split('.');
  let current = AIConfigSchema;

  for (const part of parts) {
    if (!current[part]) return undefined;
    current = current[part];
  }

  return current.default;
}

/**
 * 验证配置值
 * @param {string} path - 配置路径
 * @param {any} value - 待验证的值
 * @returns {{valid: boolean, error?: string}} 验证结果
 */
export function validateConfigValue(path, value) {
  const parts = path.split('.');
  let schema = AIConfigSchema;

  for (const part of parts) {
    if (!schema[part]) {
      return { valid: false, error: `Unknown config path: ${path}` };
    }
    schema = schema[part];
  }

  // 类型检查
  const expectedType = schema.type;
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      return { valid: false, error: `Expected array, got ${actualType}` };
    }
  } else if (actualType !== expectedType) {
    return { valid: false, error: `Expected ${expectedType}, got ${actualType}` };
  }

  // 数值范围检查
  if (expectedType === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      return { valid: false, error: `Value ${value} is less than minimum ${schema.min}` };
    }
    if (schema.max !== undefined && value > schema.max) {
      return { valid: false, error: `Value ${value} is greater than maximum ${schema.max}` };
    }
  }

  return { valid: true };
}

/**
 * 解析布尔配置值
 * @param {any} value - 原始值
 * @param {boolean} fallback - 默认值
 * @returns {boolean}
 */
export function parseBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

/**
 * 解析数值配置值
 * @param {any} value - 原始值
 * @param {number} fallback - 默认值
 * @returns {number}
 */
export function parseNumberValue(value, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 解析模型列表
 * @param {string} value - 逗号分隔的模型列表
 * @returns {string[]}
 */
export function parseModelList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}
