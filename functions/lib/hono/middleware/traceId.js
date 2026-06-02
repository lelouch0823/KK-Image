/**
 * 请求追踪中间件
 * 为每个请求生成唯一 trace ID，贯穿整个请求生命周期
 */

/**
 * 生成 UUID v4（兼容 Cloudflare Workers 环境）
 * 优先使用 crypto.randomUUID，回退到手动实现
 */
function generateTraceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 回退：基于 crypto.getRandomValues 生成 UUID 格式
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = (offset) => bytes[offset].toString(16).padStart(2, '0');
  const seg = (start, len) => Array.from({ length: len }, (_, i) => hex(start + i)).join('');
  // 设置版本 4 和变体位
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return `${seg(0, 4)}-${seg(4, 2)}-${seg(6, 2)}-${seg(8, 2)}-${seg(10, 6)}`;
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
  const existingTraceId =
    c.req.header('X-Trace-Id') ||
    c.req.header('X-Request-Id') ||
    c.req.header('X-Amzn-Trace-Id');

  const traceId = existingTraceId || generateTraceId();

  // 存入 Hono context，供 errorHandler、Sentry 等使用
  c.set('traceId', traceId);

  // 添加响应头（CORS 已配置 exposeHeaders: ['X-Request-Id']）
  c.header('X-Trace-Id', traceId);
  c.header('X-Request-Id', traceId);

  await next();
}
