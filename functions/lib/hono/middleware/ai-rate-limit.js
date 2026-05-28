import { createAIRateLimitManager } from '../../../ai/rate-limit-manager.js';

function estimateTokensFromBody(body = {}) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const rawText = messages.map((message) => {
    if (typeof message?.content === 'string') return message.content;
    if (Array.isArray(message?.content)) {
      return message.content
        .map((part) => String(part?.text || part?.image_url?.url || ''))
        .join(' ');
    }
    return '';
  }).join(' ');
  return Math.max(1, Math.ceil(rawText.length / 4));
}

function hasImageBearingMessage(body = {}) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return messages.some((message) => Array.isArray(message?.content) && message.content.some((part) => part?.type === 'image_url'));
}

function getKV(env = {}) {
  return env.AI_KV || env.KV || env.RATE_LIMIT_KV || null;
}

export function createAIRateLimitMiddleware(options = {}) {
  const createManager = options.createManager || ((deps) => createAIRateLimitManager(deps));
  const resolveConfig = options.resolveConfig || (async (c) => ({
    enabled: String(c.env.AI_RATE_LIMIT_ENABLED || 'true') !== 'false',
    requestsPerMinute: Number(c.env.AI_RATE_LIMIT_RPM || 60),
    tokensPerDay: Number(c.env.AI_RATE_LIMIT_TPD || 100000),
    imageRequestsPerMinute: Number(c.env.AI_RATE_LIMIT_IMAGE_RPM || 20),
  }));

  return async (c, next) => {
    const kv = getKV(c.env);
    const body = await c.req.raw.clone().json().catch(() => ({}));
    c.set('aiRequestBody', body);

    const testDenyReason = c.req.header('x-test-ai-quota-deny');
    const config = await resolveConfig(c);
    if (!config?.enabled || !kv) {
      return next();
    }

    // 生产环境忽略测试拒绝 header
    if (testDenyReason && c.env?.ENVIRONMENT !== 'production') {
      c.header('X-AI-RateLimit-Requests-Limit', String(config.requestsPerMinute));
      c.header('X-AI-RateLimit-Requests-Remaining', '0');
      c.header('X-AI-RateLimit-Tokens-Limit', String(config.tokensPerDay));
      c.header('X-AI-RateLimit-Tokens-Remaining', '0');
      return c.json({
        success: false,
        error: 'AI quota exceeded',
        code: testDenyReason,
      }, 429);
    }

    const manager = createManager({ kv, now: options.now });
    const result = await manager.checkAndConsume({
      userId: c.get('user')?.id || c.req.header('CF-Connecting-IP') || 'anonymous',
      requestsPerMinute: config.requestsPerMinute,
      estimatedTokens: estimateTokensFromBody(body),
      tokensPerDay: config.tokensPerDay,
      imageRequestsPerMinute: config.imageRequestsPerMinute,
      imageBearing: hasImageBearingMessage(body),
    });

    c.set('aiQuotaDecision', result);
    c.header('X-AI-RateLimit-Requests-Limit', String(config.requestsPerMinute));
    c.header('X-AI-RateLimit-Requests-Remaining', String(result.remaining?.requests ?? 0));
    c.header('X-AI-RateLimit-Tokens-Limit', String(config.tokensPerDay));
    c.header('X-AI-RateLimit-Tokens-Remaining', String(result.remaining?.tokens ?? 0));

    if (!result.allowed) {
      return c.json({
        success: false,
        error: 'AI quota exceeded',
        code: result.reason,
        quotaDecision: result.reason,
      }, 429);
    }

    return next();
  };
}

export const aiRateLimitMiddleware = createAIRateLimitMiddleware();
