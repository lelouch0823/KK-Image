# AI模块优化开发设计与实施计划

> 状态：已过时，不再作为主执行计划。
> 
> 原因：本文档与当前代码现状已有明显偏差，部分能力已提前落地，部分设计已不满足后续 SOTA 目标。
> 
> 当前应以 [2026-03-16-ai-module-overall-optimization-v2.md](O:/Code/KK-Image/docs/plans/2026-03-16-ai-module-overall-optimization-v2.md) 为主计划继续推进。

## 一、项目背景与目标

### 1.1 背景
KK-Image AI模块是一个企业级AI助手系统，支持多模型切换、流式响应、工具调用和动作执行。当前已实现基础功能，但在配置化、性能、安全性和可观测性方面需要进一步优化。

### 1.2 目标
- **配置化**：支持运行时调整AI参数，无需重新部署
- **性能优化**：工具调用并行化、流式响应中断处理
- **安全性增强**：输入长度限制、敏感数据过滤、用户级限流
- **可观测性**：端到端追踪、Token使用量统计
- **可靠性**：智能重试策略、优雅降级

---

## 二、总体架构设计

### 2.1 优化后架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         配置管理层 (Configuration)                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  SettingsRepository 扩展                                      │   │
│  │  - 支持动态配置热加载                                          │   │
│  │  - 配置变更审计日志                                            │   │
│  │  - 分层配置：系统默认 < 环境变量 < DB配置                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API路由层 (Hono Routes)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ RateLimit中间件  │  │ AbortController │  │ 性能监控中间件       │  │
│  │ (用户级限流)     │  │ (请求取消)      │  │ (延迟/Token追踪)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI核心服务层 (AI Core Services)                 │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐ │
│  │ ModelManager      │  │ StreamingEngine   │  │ ToolOrchestrator│ │
│  │ (模型管理)         │  │ (流式引擎V2)       │  │ (并行工具执行)   │ │
│  │ - 健康状态持久化   │  │ - 支持中断         │  │ - 并发控制       │ │
│  │ - 智能负载均衡     │  │ - 动态门控         │  │ - 结果聚合       │ │
│  └───────────────────┘  └───────────────────┘  └─────────────────┘ │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐ │
│  │ RetryManager      │  │ ContentFilter     │  │ Telemetry       │ │
│  │ (智能重试)         │  │ (内容过滤器)       │  │ (遥测系统V2)     │ │
│  │ - 指数退避         │  │ - 输入校验         │  │ - Trace追踪     │ │
│  │ - 抖动策略         │  │ - 输出脱敏         │  │ - Token统计     │ │
│  └───────────────────┘  └───────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流图

```
用户请求
    │
    ▼
┌───────────────┐    命中限制     ┌───────────────┐
│  用户级限流    │ ─────────────▶ │   返回429     │
│  RateLimit    │                └───────────────┘
└───────────────┘
    │ 通过
    ▼
┌───────────────┐    取消请求     ┌───────────────┐
│ AbortController│ ─────────────▶ │   清理资源    │
└───────────────┘                └───────────────┘
    │
    ▼
┌───────────────┐
│  配置加载      │◀────────────────────────────┐
│ (SettingsRepo) │     配置变更事件            │
└───────────────┘                              │
    │                                          │
    ▼                                          │
┌───────────────┐     失败/限流   ┌───────────┴───┐
│   AI调用      │ ─────────────▶ │  模型切换逻辑  │
│  callAIStream │                │  (健康度评估)  │
└───────────────┘                └───────────────┘
    │
    ▼
┌───────────────┐
│  SSE流处理    │
│ (ContentGate) │
└───────────────┘
    │
    ▼
┌───────────────┐    工具调用    ┌───────────────┐
│  工具检测      │ ────────────▶ │  并行执行     │
│  (tool_calls) │                │ Promise.all   │
└───────────────┘                └───────────────┘
    │                                  │
    │ 无需工具                          ▼
    │                            ┌───────────────┐
    │                            │  结果返回     │
    │                            │  (emit SSE)   │
    │                            └───────────────┘
    ▼
┌───────────────┐
│  直接返回文本  │
└───────────────┘
```

---

## 三、详细设计方案

### 3.1 配置化系统（Phase 1）

#### 3.1.1 配置模型设计

```typescript
// 新增：functions/ai/config-schema.js
export const AIConfigSchema = {
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
};
```

#### 3.1.2 配置管理器实现

```javascript
// 新增：functions/ai/config-manager.js
export class AIConfigManager {
  constructor(db, env) {
    this.settingsRepo = new SettingsRepository(db);
    this.env = env;
    this.cache = new Map();
    this.cacheExpiry = 30000; // 30秒缓存
  }

  async getConfig(key, category = 'ai') {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.cacheExpiry) {
      return cached.value;
    }

    // 读取优先级: DB > 环境变量 > 默认值
    const dbValue = await this.settingsRepo.get(key, category);
    const envValue = this.env[key];
    const defaultValue = this.getDefault(key);

    const value = dbValue ?? envValue ?? defaultValue;
    this.cache.set(key, { value, ts: Date.now() });
    return value;
  }

  async getFullConfig() {
    // 返回完整配置对象
  }

  invalidateCache() {
    this.cache.clear();
  }
}
```

### 3.2 流式响应中断处理（Phase 2）

#### 3.2.1 AbortController集成

```javascript
// 修改：functions/lib/hono/routes/manage/ai.js
app.post('/stream', async (c) => {
  const abortController = new AbortController();
  const { signal } = abortController;

  // 监听客户端断开
  c.req.raw.signal?.addEventListener('abort', () => {
    abortController.abort();
  });

  return streamSSE(c, async (stream) => {
    try {
      const streamResult = await callAIStream(messages, tools, runtimeEnv, {
        signal, // 传递取消信号
      });

      // 在stream-engine中检查signal
      await runAIStreamEngine({
        ...options,
        signal,
        shouldStop: () => signal.aborted,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[AI Stream] Client disconnected, cleaned up');
        return;
      }
      throw err;
    }
  });
});
```

#### 3.2.2 流引擎增强

```javascript
// 修改：functions/ai/stream-engine.js
export async function runAIStreamEngine({
  signal,
  shouldStop = () => false,
  onAbort = () => {},
  ...options
} = {}) {
  // 定期检查取消信号
  const checkAbort = () => {
    if (signal?.aborted || shouldStop()) {
      onAbort();
      throw new AbortError('Stream aborted');
    }
  };

  // 在循环中检查
  while (!done) {
    checkAbort();
    const { done, value } = await reader.read();
    // ...处理逻辑
  }
}
```

### 3.3 工具调用并行化（Phase 3）

#### 3.3.1 并行工具执行器

```javascript
// 修改：functions/utils/ai-tool-executor.js
export async function executeAIToolsParallel(toolCalls, repos, options = {}) {
  const { maxConcurrency = 5, timeoutMs = 10000 } = options;

  // 将工具调用分批处理
  const batches = chunkArray(toolCalls, maxConcurrency);
  const results = [];

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(tc => executeAIToolWithTimeout(tc.name, tc.args, repos, timeoutMs))
    );

    results.push(...batchResults.map((result, idx) => ({
      toolCall: batch[idx],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    })));
  }

  return results;
}

async function executeAIToolWithTimeout(name, args, repos, timeoutMs) {
  return Promise.race([
    executeAITool(name, args, repos),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool ${name} timeout`)), timeoutMs)
    ),
  ]);
}
```

#### 3.3.2 依赖关系处理

```javascript
// 新增：支持工具间的依赖声明
const TOOL_DEPENDENCIES = {
  getVariantDetail: [], // 无依赖
  searchVariants: [],   // 无依赖
  getOrderDetail: [],   // 无依赖
  // 可以声明复杂依赖关系
};

// 拓扑排序后并行执行无依赖工具
function topologicalSort(toolCalls) {
  // 实现拓扑排序算法
}
```

### 3.4 智能重试策略（Phase 4）

#### 3.4.1 指数退避实现

```javascript
// 新增：functions/ai/retry-manager.js
export class RetryManager {
  constructor(config) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      enableJitter: true,
      ...config,
    };
  }

  calculateDelay(attempt) {
    const { baseDelayMs, backoffMultiplier, maxDelayMs, enableJitter } = this.config;

    // 指数退避: baseDelay * (multiplier ^ attempt)
    const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
    const delay = Math.min(exponentialDelay, maxDelayMs);

    // 添加抖动: ±25%
    if (enableJitter) {
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      return delay + jitter;
    }

    return delay;
  }

  async execute(operation, context = {}) {
    const { maxRetries } = this.config;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error) || attempt >= maxRetries) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, context);
        await sleep(delay);
      }
    }

    throw lastError;
  }

  isRetryable(error) {
    // 可重试错误: 429限流, 5xx服务器错误, 网络错误
    const retryableStatuses = [429, 502, 503, 504];
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];

    if (error.status && retryableStatuses.includes(error.status)) return true;
    if (error.code && retryableCodes.includes(error.code)) return true;
    if (error.message?.includes('rate limit')) return true;

    return false;
  }
}
```

### 3.5 用户级限流（Phase 5）

#### 3.5.1 限流中间件实现

```javascript
// 新增：functions/lib/hono/middleware/ai-rate-limit.js
import { RateLimitManager } from '../../../ai/rate-limit-manager.js';

export function aiRateLimit(options = {}) {
  const manager = new RateLimitManager(options);

  return async (c, next) => {
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const check = await manager.checkLimit(userId, {
      // 基于配置的限流规则
      requestsPerMinute: c.env.AI_RATE_LIMIT_RPM || 60,
      tokensPerDay: c.env.AI_RATE_LIMIT_TPD || 100000,
    });

    if (!check.allowed) {
      return c.json({
        error: 'Rate limit exceeded',
        retryAfter: check.retryAfter,
        limit: check.limit,
        remaining: check.remaining,
      }, 429);
    }

    // 设置响应头
    c.header('X-RateLimit-Limit', String(check.limit));
    c.header('X-RateLimit-Remaining', String(check.remaining));
    c.header('X-RateLimit-Reset', String(check.resetTime));

    await next();
  };
}
```

#### 3.5.2 限流管理器

```javascript
// 新增：functions/ai/rate-limit-manager.js
export class RateLimitManager {
  constructor(kv) {
    this.kv = kv;
  }

  async checkLimit(userId, rules) {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);
    const dayKey = Math.floor(now / 86400000);

    // 检查分钟级限制
    const minuteCount = await this.getCount(`ai_ratelimit:${userId}:${minuteKey}`);
    if (minuteCount >= rules.requestsPerMinute) {
      return {
        allowed: false,
        retryAfter: 60 - (now % 60000) / 1000,
        limit: rules.requestsPerMinute,
        remaining: 0,
      };
    }

    // 检查日级Token限制
    const dailyTokens = await this.getCount(`ai_tokens:${userId}:${dayKey}`);
    // ...

    // 增加计数
    await this.incrementCount(`ai_ratelimit:${userId}:${minuteKey}`, 60);

    return {
      allowed: true,
      limit: rules.requestsPerMinute,
      remaining: rules.requestsPerMinute - minuteCount - 1,
      resetTime: (minuteKey + 1) * 60000,
    };
  }
}
```

### 3.6 可观测性增强（Phase 6）

#### 3.6.1 遥测系统V2

```javascript
// 新增：functions/ai/telemetry-v2.js
export class AITelemetry {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.sampleRate = options.sampleRate ?? 1.0;
    this.includeTokenUsage = options.includeTokenUsage ?? true;
  }

  createTrace(context) {
    return new AITrace(this, context);
  }
}

export class AITrace {
  constructor(telemetry, context) {
    this.telemetry = telemetry;
    this.traceId = crypto.randomUUID();
    this.spans = [];
    this.startTime = performance.now();
    this.context = context;
  }

  startSpan(name, attributes = {}) {
    const span = {
      name,
      startTime: performance.now(),
      attributes,
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span, result = {}) {
    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
    span.result = result;
  }

  recordTokenUsage(usage) {
    this.tokenUsage = usage;
  }

  async flush() {
    if (!this.telemetry.enabled) return;
    if (Math.random() > this.telemetry.sampleRate) return;

    const trace = {
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      duration: performance.now() - this.startTime,
      context: this.context,
      spans: this.spans,
      tokenUsage: this.tokenUsage,
    };

    // 异步写入日志/分析系统
    console.log('[AITelemetry]', JSON.stringify(trace));
  }
}
```

#### 3.6.2 结构化日志

```javascript
// 新增：functions/ai/logger.js
export function createAILogger(context) {
  const baseFields = {
    traceId: context.traceId,
    userId: context.userId,
    sessionId: context.sessionId,
    model: context.model,
  };

  return {
    info: (event, data) => {
      console.log(JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        event,
        ...baseFields,
        ...data,
      }));
    },

    error: (event, error, data) => {
      console.error(JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        event,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          status: error.status,
        },
        ...baseFields,
        ...data,
      }));
    },

    metric: (name, value, tags = {}) => {
      console.log(JSON.stringify({
        level: 'metric',
        timestamp: new Date().toISOString(),
        metric: name,
        value,
        tags: { ...baseFields, ...tags },
      }));
    },
  };
}
```

### 3.7 安全性增强（Phase 7）

#### 3.7.1 输入验证器

```javascript
// 新增：functions/ai/input-validator.js
export class InputValidator {
  constructor(config) {
    this.config = config;
  }

  validateMessage(message) {
    const errors = [];

    // 长度检查
    const text = this.extractText(message);
    if (text.length > this.config.maxInputLength) {
      errors.push(`Input exceeds maximum length of ${this.config.maxInputLength}`);
    }

    // 图片检查
    const images = this.extractImages(message);
    for (const img of images) {
      if (img.size && img.size > this.config.maxImageSize) {
        errors.push(`Image exceeds maximum size of ${this.config.maxImageSize}`);
      }
    }

    // 图片数量限制
    if (images.length > 10) {
      errors.push('Too many images (max 10)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  extractText(message) {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');
    }
    return '';
  }

  extractImages(message) {
    if (typeof message.content === 'string') return [];
    if (Array.isArray(message.content)) {
      return message.content.filter(c => c.type === 'image_url');
    }
    return [];
  }
}
```

#### 3.7.2 数据脱敏器

```javascript
// 新增：functions/ai/data-masker.js
const SENSITIVE_PATTERNS = [
  { pattern: /\b1[3-9]\d{9}\b/g, mask: '***PHONE***' }, // 手机号
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, mask: '***EMAIL***' }, // 邮箱
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g, mask: '***APIKEY***' }, // API密钥
  { pattern: /\b\d{17}[\dXx]\b/g, mask: '***ID***' }, // 身份证号
];

export function maskSensitiveData(text) {
  let masked = text;
  for (const { pattern, mask } of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, mask);
  }
  return masked;
}

export function maskToolResult(result, fieldsToMask = []) {
  if (!result || typeof result !== 'object') return result;

  const masked = { ...result };
  for (const field of fieldsToMask) {
    if (field in masked) {
      masked[field] = '***MASKED***';
    }
  }
  return masked;
}
```

---

## 四、数据库变更

### 4.1 新增配置表

```sql
-- 已有Settings表结构，无需变更
-- 新增AI特定配置项示例
INSERT INTO settings (key, value, category, description) VALUES
('AI_MAX_TOOL_ROUNDS', '3', 'ai', 'Maximum tool execution rounds'),
('AI_MAX_TOOLS_PER_ROUND', '8', 'ai', 'Maximum tools per round'),
('AI_RATE_LIMIT_RPM', '60', 'ai', 'Rate limit: requests per minute'),
('AI_RATE_LIMIT_TPD', '100000', 'ai', 'Rate limit: tokens per day'),
('AI_MAX_INPUT_LENGTH', '10000', 'ai', 'Maximum input text length'),
('AI_MAX_IMAGE_SIZE', '5000000', 'ai', 'Maximum image size in bytes'),
('AI_RETRY_MAX_RETRIES', '3', 'ai', 'Maximum retry attempts'),
('AI_RETRY_BASE_DELAY_MS', '1000', 'ai', 'Retry base delay in ms'),
('AI_TELEMETRY_ENABLED', 'true', 'ai', 'Enable telemetry'),
('AI_TELEMETRY_SAMPLE_RATE', '1.0', 'ai', 'Telemetry sample rate');
```

### 4.2 新增遥测日志表

```sql
-- migrations/00XX_ai_telemetry_logs.sql
CREATE TABLE ai_telemetry_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  model TEXT,
  request_type TEXT, -- 'chat', 'stream', 'action'
  duration_ms INTEGER,
  token_input INTEGER,
  token_output INTEGER,
  tool_calls_count INTEGER,
  error_type TEXT,
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_ai_telemetry_trace ON ai_telemetry_logs(trace_id);
CREATE INDEX idx_ai_telemetry_user ON ai_telemetry_logs(user_id);
CREATE INDEX idx_ai_telemetry_created ON ai_telemetry_logs(created_at);
```

---

## 五、实施计划

### Phase 1: 配置化系统（Week 1-2）

| 任务 | 文件 | 工时 |
|------|------|------|
| 创建配置Schema | `functions/ai/config-schema.js` | 4h |
| 实现配置管理器 | `functions/ai/config-manager.js` | 8h |
| 修改配置加载逻辑 | `functions/lib/hono/routes/manage/ai.js` | 4h |
| 前端配置界面增强 | `src/components/settings/tabs/AISettings.vue` | 8h |
| 单元测试 | `functions/ai/__tests__/config-manager.test.js` | 8h |
| **小计** | | **32h** |

**交付物**:
- 支持运行时调整所有AI参数
- 配置热加载（30秒缓存）
- 配置变更审计

### Phase 2: 流式响应中断（Week 2-3）

| 任务 | 文件 | 工时 |
|------|------|------|
| AbortController集成 | `functions/lib/hono/routes/manage/ai.js` | 4h |
| 流引擎增强 | `functions/ai/stream-engine.js` | 6h |
| 资源清理机制 | `functions/ai/stream-cleanup.js` | 4h |
| 测试用例 | `functions/ai/__tests__/stream-engine.test.js` | 6h |
| **小计** | | **20h** |

**交付物**:
- 客户端断开时立即释放资源
- 无内存泄漏
- 优雅的取消处理

### Phase 3: 工具调用并行化（Week 3-4）

| 任务 | 文件 | 工时 |
|------|------|------|
| 并行执行器实现 | `functions/utils/ai-tool-executor.js` | 8h |
| 超时控制机制 | `functions/utils/ai-tool-executor.js` | 4h |
| 依赖排序算法（可选） | `functions/ai/tool-dependency.js` | 6h |
| 集成到流引擎 | `functions/ai/stream-engine.js` | 4h |
| 测试 | `functions/utils/__tests__/ai-tool-executor.test.js` | 8h |
| **小计** | | **30h** |

**交付物**:
- 独立工具并行执行
- 工具超时控制
- 结果正确聚合

### Phase 4: 智能重试策略（Week 4）

| 任务 | 文件 | 工时 |
|------|------|------|
| 重试管理器实现 | `functions/ai/retry-manager.js` | 8h |
| 集成到AI调用 | `functions/utils/ai-utils.js` | 6h |
| 配置化重试参数 | `functions/ai/config-manager.js` | 4h |
| 测试 | `functions/ai/__tests__/retry-manager.test.js` | 6h |
| **小计** | | **24h** |

**交付物**:
- 指数退避 + 抖动
- 智能错误分类
- 可配置重试策略

### Phase 5: 用户级限流（Week 5）

| 任务 | 文件 | 工时 |
|------|------|------|
| 限流管理器 | `functions/ai/rate-limit-manager.js` | 8h |
| 限流中间件 | `functions/lib/hono/middleware/ai-rate-limit.js` | 6h |
| 集成到路由 | `functions/lib/hono/routes/manage/ai.js` | 4h |
| KV存储集成 | `functions/ai/rate-limit-manager.js` | 4h |
| 测试 | 新增测试文件 | 6h |
| **小计** | | **28h** |

**交付物**:
- 用户级分钟/日限流
- 429响应带Retry-After头
- 限流状态可见

### Phase 6: 可观测性（Week 6）

| 任务 | 文件 | 工时 |
|------|------|------|
| 遥测系统V2 | `functions/ai/telemetry-v2.js` | 10h |
| 结构化日志 | `functions/ai/logger.js` | 6h |
| 数据库表 | `migrations/00XX_ai_telemetry_logs.sql` | 2h |
| 集成到全链路 | 多个文件 | 8h |
| 日志分析工具 | `scripts/analyze-ai-logs.js` | 6h |
| **小计** | | **32h** |

**交付物**:
- Trace ID追踪
- Token使用量统计
n- 结构化日志输出

### Phase 7: 安全性增强（Week 7）

| 任务 | 文件 | 工时 |
|------|------|------|
| 输入验证器 | `functions/ai/input-validator.js` | 6h |
| 数据脱敏器 | `functions/ai/data-masker.js` | 6h |
| 集成验证 | `functions/lib/hono/routes/manage/ai.js` | 4h |
| 工具结果脱敏 | `functions/utils/ai-tool-executor.js` | 4h |
| 测试 | 新增测试文件 | 6h |
| **小计** | | **26h** |

**交付物**:
- 输入长度/大小限制
- 敏感数据自动脱敏
- 图片数量和大小控制

---

## 六、总时间线

```
Week 1:  ████████████████████████████████████████ Phase 1 配置化
Week 2:  ████████████████████░░░░░░░░░░░░░░░░░░░░ Phase 1 完成 + Phase 2开始
Week 3:  ░░░░░░░░░░░░░░░░░░░░████████████████████ Phase 2 完成 + Phase 3
Week 4:  ████████████████████████████████████████ Phase 3 完成 + Phase 4
Week 5:  ████████████████████████████████████████ Phase 5 限流
Week 6:  ████████████████████████████████████████ Phase 6 可观测性
Week 7:  ████████████████████████████████████████ Phase 7 安全性
Week 8:  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 集成测试 + Bug修复
```

**总工时**: ~192小时（约5周开发 + 1周测试）

---

## 七、风险评估与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| KV限流影响限流功能 | 中 | 高 | 实现本地回退 + 限流降级 |
| AbortController兼容性问题 | 低 | 中 | 特性检测 + 优雅降级 |
| 并行工具导致数据库压力 | 中 | 中 | 连接池控制 + 并发数限制 |
| 配置热加载导致不一致 | 低 | 中 | 短缓存时间 + 版本控制 |
| Token统计精度问题 | 中 | 低 | 文档说明 + 估算策略 |

---

## 八、验收标准

### 8.1 功能验收

- [ ] 所有AI参数支持DB配置，30秒内生效
- [ ] 客户端断开时资源立即释放（<100ms）
- [ ] 独立工具调用并行执行，延迟减少30%+
- [ ] 429错误自动重试，最大3次，指数退避
- [ ] 用户级限流生效，超限返回429
- [ ] 所有请求包含Trace ID，可追踪全链路
- [ ] 输入超长/超大图片被拒绝
- [ ] 日志中无敏感数据泄露

### 8.2 性能验收

- [ ] 流式首字节时间 < 500ms
- [ ] 工具调用总延迟（3个并行工具）< 1s
- [ ] 配置加载延迟 < 10ms（缓存命中）
- [ ] 内存使用稳定，无持续增长

### 8.3 测试覆盖

- [ ] 新代码单元测试覆盖率 > 80%
- [ ] 集成测试覆盖所有关键路径
- [ ] 负载测试验证限流功能

---

## 九、附录

### 9.1 新增文件清单

```
functions/
├── ai/
│   ├── config-schema.js
│   ├── config-manager.js
│   ├── retry-manager.js
│   ├── rate-limit-manager.js
│   ├── telemetry-v2.js
│   ├── logger.js
│   ├── input-validator.js
│   ├── data-masker.js
│   ├── stream-cleanup.js
│   └── tool-dependency.js
└── lib/hono/middleware/
    └── ai-rate-limit.js

migrations/
└── 00XX_ai_telemetry_logs.sql
```

### 9.2 修改文件清单

```
functions/
├── lib/hono/routes/manage/ai.js
├── ai/stream-engine.js
├── utils/ai-utils.js
├── utils/ai-tool-executor.js
└── utils/ai-stream-helpers.js

src/components/settings/tabs/AISettings.vue
```

### 9.3 参考文档

- [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/examples/rate-limiting/)
- [AbortController MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [OpenAI API Error Handling](https://platform.openai.com/docs/guides/error-codes)
