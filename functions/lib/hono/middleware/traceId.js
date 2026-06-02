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
  // 回退：基于随机数生成 UUID 格式
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const seg = (len) => Array.from({ length: len }, hex).join('');
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${[8, 9, 'a', 'b'][Math.floor(Math.random() * 4)]}${seg(3)}-${seg(12)}`;
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
