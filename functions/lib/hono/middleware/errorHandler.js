import {
  getAuditScheduler,
  getRequestAuditContext,
  inferAuditDomainFromPath,
  inferAuditTargetFromPath,
  recordAuditEvent,
  setAuditFailureRecorded,
  shouldAuditRequest,
} from '../_shared/audit-helpers.js';

/**
 * 全局错误处理句柄 (app.onError)
 * 接管所有抛出的异常并标准化返回
 */
export function errorHandler(err, c) {
  // 获取 trace ID（由 traceIdMiddleware 设置）
  const traceId = c.get('traceId') || null;

  console.error(
    '[GlobalErrorHandler]',
    err.name,
    err.message,
    traceId ? `[traceId=${traceId}]` : '',
    err.stack
  );

  // 将 trace ID 附加到 Sentry 事件（如果 Sentry 已初始化）
  try {
    const Sentry = globalThis.__SENTRY__;
    if (Sentry && traceId) {
      Sentry.setTag('traceId', traceId);
      Sentry.setContext('request', { traceId, path: c.req.path, method: c.req.method });
    }
  } catch {
    // Sentry 不可用时静默忽略
  }

  // 根据错误类型确定状态码 (保留对旧报错的兼容性)
  const statusMap = {
    ValidationError: 400,
    AuthenticationError: 401,
    AuthorizationError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    RateLimitError: 429,
  };

  const status = err.statusCode || statusMap[err.name] || 500;
  const message = status === 500 && !err.statusCode ? 'Internal Server Error' : err.message;

  if (shouldAuditRequest(c.req.method, c.req.path) && c.env?.DB && !c.get('auditFailureRecorded')) {
    const auditContext = getRequestAuditContext(c);
    const domain = inferAuditDomainFromPath(c.req.path);
    const targetId = inferAuditTargetFromPath(c.req.path);
    const scheduler = getAuditScheduler(c);
    setAuditFailureRecorded(c);
    scheduler(
      recordAuditEvent(c.env.DB, {
        ...auditContext,
        userId: auditContext.actor_id,
        domain,
        action: `${domain}.${c.req.method.toLowerCase()}.failed`,
        result: 'failed',
        severity: status >= 500 ? 'critical' : 'high',
        targetType: domain,
        targetId,
        summary: `${c.req.method} ${c.req.path} failed`,
        metadata: {
          path: c.req.path,
          method: c.req.method,
          error_code: err.code || err.name || 'INTERNAL_ERROR',
          status,
        },
        ip: auditContext.ip_address,
        user_agent: auditContext.user_agent,
      })
    );
  }

  return c.json(
    {
      success: false,
      error: message,
      code: err.code || err.name || 'INTERNAL_ERROR',
      ...(traceId && { traceId }),
      // M06: 仅在明确配置为开发环境时才泄露堆栈，默认不泄露
      ...(c.env?.ENVIRONMENT === 'development' && { stack: err.stack }),
    },
    status
  );
}
