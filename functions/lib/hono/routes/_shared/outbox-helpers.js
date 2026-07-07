import { runOutboxPoller } from '../../../../api/cron/outbox.js';

/**
 * 调度 Outbox 异步处理（Hono 路由共享）
 * @param {import('hono').Context} c - Hono 上下文
 * @param {string} workerId - Worker 标识
 */
export function scheduleOutboxProcessing(c, workerId) {
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId,
    })
  );
}

/**
 * 获取幂等键（Hono 路由共享）
 * 优先使用请求头 Idempotency-Key，否则自动生成 UUID
 * @param {import('hono').Context} c - Hono 上下文
 * @returns {string}
 */
export function getIdempotencyKey(c) {
  const requestKey = String(c.req.header('Idempotency-Key') || '').trim();
  return requestKey || crypto.randomUUID();
}
