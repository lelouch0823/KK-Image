import { generateId } from '../../../api/utils/id.js';

/**
 * 请求追踪中间件
 * 为每个请求生成唯一 trace ID，贯穿整个请求生命周期
 */

// 客户端透传的 trace ID 仅接受受限字符集与长度（防日志注入与缓存污染）
const TRACE_ID_MAX_LENGTH = 128;
const TRACE_ID_PATTERN = /^[\w.:@/-]+$/;

function sanitizeIncomingTraceId(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.length > TRACE_ID_MAX_LENGTH || !TRACE_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Trace ID 中间件
 * - 优先从 X-Request-Id / X-Trace-Id 请求头读取（支持链路透传）
 * - 否则自动生成 UUID
 * - 写入 context 供下游使用
 * - 添加 X-Trace-Id 响应头
 */
export async function traceIdMiddleware(c, next) {
  // 支持从请求头透传 trace ID（微服务链路追踪场景）
  const incomingTraceId = sanitizeIncomingTraceId(
    c.req.header('X-Trace-Id') || c.req.header('X-Request-Id') || c.req.header('X-Amzn-Trace-Id')
  );

  const traceId = incomingTraceId || generateId();

  // 存入 Hono context，供 errorHandler、Sentry 等使用
  c.set('traceId', traceId);

  // 添加响应头（CORS 已配置 exposeHeaders: ['X-Request-Id']）
  c.header('X-Trace-Id', traceId);
  c.header('X-Request-Id', traceId);

  await next();
}
