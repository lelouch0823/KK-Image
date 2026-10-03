/**
 * 幂等键工具
 *
 * 资金/库存类命令（收款、退款、建单、行级履约）必须携带 Idempotency-Key：
 * - 传输层重放（连接重置后的浏览器重发、上层重试）凭同键去重；
 * - 服务端 command_idempotency 按键返回首次结果，而非二次执行。
 *
 * 键的生命周期 = 一次"逻辑操作"：在操作发起时（表单提交、按钮回调）生成
 * 一次，同一逻辑操作的所有 HTTP 尝试复用；不是每个 HTTP 请求一个新键。
 */

/** 生成新的幂等键（UUID，带前缀便于日志排查） */
export function createIdempotencyKey(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `idem-${uuid}`;
}

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** 判断请求是否为需要幂等键的变更方法 */
export function isMutationMethod(method: string | undefined): boolean {
  const normalized = (method || 'GET').toUpperCase();
  return normalized === 'POST' || normalized === 'PATCH' || normalized === 'PUT';
}

/**
 * 为 fetch 选项注入幂等键（若调用方未显式提供）。
 * 在 http-core 的 request() 内调用，保证全站变更请求默认带键。
 */
export function injectIdempotencyKey(
  headers: HeadersInit | undefined,
  method: string | undefined
): HeadersInit {
  const base = new Headers(headers ?? {});
  if (isMutationMethod(method) && !base.has(IDEMPOTENCY_HEADER)) {
    base.set(IDEMPOTENCY_HEADER, createIdempotencyKey());
  }
  return base;
}
