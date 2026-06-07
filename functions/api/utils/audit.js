import { getRequestAuditContext, recordAuditEvent } from '../../lib/hono/_shared/audit-helpers.js';

/**
 * 记录一条审计日志到 D1
 * @param {D1Database} db - D1 数据库实例
 * @param {object} params
 * @param {string} params.userId - 操作用户 ID
 * @param {string} params.action - 操作类型，如 'files:delete', 'order:create'
 * @param {string} params.targetType - 目标实体类型，如 'file', 'order', 'user'
 * @param {string} [params.targetId] - 目标实体 ID
 * @param {object|string} [params.payload] - 变更详情（会被序列化为 JSON）
 * @param {string} [params.ip] - 来源 IP
 */
export async function logAudit(
  db,
  { userId, action, targetType, targetId = null, payload = null, ip = null }
) {
  try {
    await recordAuditEvent(db, { userId, action, targetType, targetId, payload, ip });
  } catch (err) {
    // 审计日志写入失败不应阻断正常业务，只打印错误
    console.error('[AuditLog] 写入失败:', err);
  }
}

/**
 * 从 Hono Context 提取审计所需的公共信息
 * @param {import('hono').Context} c
 * @returns {{ userId: string, ip: string }}
 */
export function getAuditContext(c) {
  const context = getRequestAuditContext(c);
  return {
    userId: context.actor_id,
    ip: context.ip_address,
    actorType: context.actor_type,
    actorName: context.actor_name,
    actorRole: context.actor_role,
    sourceApp: context.source_app,
    requestId: context.request_id,
    traceId: context.trace_id,
    userAgent: context.user_agent,
  };
}
