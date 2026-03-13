import { generateId, now } from '../../../api/utils/id.js';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /password|token|secret|cookie|authorization|jwt|api[-_]?key/i;
const PARTIAL_MASK_PATTERN = /email|phone|mobile/i;

function maskPartialValue(value) {
  if (typeof value !== 'string' || value.length < 3) return REDACTED;
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    const safeName = `${name.slice(0, 1)}***`;
    return `${safeName}@${domain}`;
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function sanitizeAuditData(input) {
  if (Array.isArray(input)) return input.map((item) => sanitizeAuditData(item));
  if (!input || typeof input !== 'object') return input;

  const sanitized = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }
    if (PARTIAL_MASK_PATTERN.test(key)) {
      sanitized[key] = maskPartialValue(value);
      continue;
    }
    sanitized[key] = sanitizeAuditData(value);
  }
  return sanitized;
}

function inferSourceApp(c) {
  const explicit = c?.req?.header?.('X-Source-App');
  if (explicit) return explicit;
  const user = c?.get?.('user');
  if (user?.type === 'sales') return 'sales-web';
  if (user?.type === 'admin' || user?.role === 'admin') return 'admin-web';
  return 'unknown';
}

export function getRequestAuditContext(c) {
  const user = c?.get?.('user');
  const ip = c?.req?.header?.('CF-Connecting-IP') || c?.req?.header?.('X-Forwarded-For') || 'unknown';
  return {
    actor_type: user?.type || (user?.role === 'admin' ? 'admin' : 'anonymous'),
    actor_id: user?.id || 'anonymous',
    actor_name: user?.name || user?.username || 'Anonymous',
    actor_role: user?.role || user?.type || 'anonymous',
    ip_address: ip,
    user_agent: c?.req?.header?.('User-Agent') || 'unknown',
    request_id: c?.req?.header?.('CF-Ray') || c?.req?.header?.('X-Request-Id') || null,
    trace_id: c?.req?.header?.('X-Trace-Id') || null,
    source_app: inferSourceApp(c),
  };
}

export function inferAuditDomainFromPath(path = '') {
  const parts = String(path).split('/').filter(Boolean);
  if (parts[0] !== 'api') return 'system';
  if (parts[1] === 'manage' || parts[1] === 'sales' || parts[1] === 'v1') {
    return parts[2] || parts[1];
  }
  return parts[1] || 'system';
}

export function inferAuditTargetFromPath(path = '') {
  const parts = String(path).split('/').filter(Boolean);
  const candidate = parts[parts.length - 1] || null;
  if (!candidate || ['api', 'manage', 'sales', 'v1'].includes(candidate)) {
    return null;
  }
  return candidate;
}

export function buildAuditEvent(params = {}) {
  const metadata = sanitizeAuditData(params.metadata_json ?? params.metadata ?? {});
  const legacyPayload = sanitizeAuditData(params.payload ?? null);
  const normalizedChanges = sanitizeAuditData(params.changes_json ?? metadata.changes_json ?? metadata.changes ?? null);
  const actorId = params.actor_id || params.userId || params.actor?.id || 'anonymous';
  const actorType = params.actor_type || params.actor?.type || 'system';

  return {
    id: params.id || generateId(),
    user_id: params.userId || actorId,
    actor_type: actorType,
    actor_id: actorId,
    actor_name: params.actor_name || params.actor?.name || null,
    actor_role: params.actor_role || params.actor?.role || null,
    source_app: params.source_app || params.sourceApp || null,
    request_id: params.request_id || params.requestId || null,
    trace_id: params.trace_id || params.traceId || null,
    domain: params.domain || metadata.domain || params.targetType || 'system',
    action: params.action,
    result: params.result || metadata.result || 'success',
    severity: params.severity || metadata.severity || 'normal',
    target_type: params.targetType || params.target_type || params.target?.type || 'system',
    target_id: params.targetId || params.target_id || params.target?.id || null,
    target_label: params.target_label || params.target?.label || metadata.target_label || null,
    summary: params.summary || metadata.summary || null,
    payload: legacyPayload ? JSON.stringify(legacyPayload) : null,
    changes_json: normalizedChanges ? JSON.stringify(normalizedChanges) : null,
    metadata_json: metadata ? JSON.stringify(metadata) : null,
    ip_address: params.ip || params.ip_address || null,
    user_agent: params.user_agent || null,
    created_at: params.created_at || now(),
  };
}

export function buildRequestAuditEvent(c, params = {}) {
  const requestContext = getRequestAuditContext(c);
  return buildAuditEvent({
    ...requestContext,
    userId: requestContext.actor_id,
    ip: requestContext.ip_address,
    user_agent: requestContext.user_agent,
    ...params,
  });
}

export function shouldAuditRequest(method, path = '') {
  const normalizedMethod = String(method || '').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    return true;
  }
  const normalizedPath = String(path || '');
  return normalizedMethod === 'GET' && /\/api\/(?:manage|v1)\/audit-logs\/export(?:\/)?$/.test(normalizedPath);
}

export function getAuditScheduler(c) {
  let executionCtx = null;
  try {
    executionCtx = c?.executionCtx;
  } catch {
    executionCtx = null;
  }
  if (executionCtx?.waitUntil) {
    return (promise) => executionCtx.waitUntil(promise);
  }
  return async (promise) => {
    await promise;
  };
}

export async function recordAuditEvent(db, params = {}) {
  if (!db || typeof db.prepare !== 'function') return null;
  const event = buildAuditEvent(params);
  const stmt = db.prepare(
    `INSERT INTO audit_logs (
        id,
        user_id,
        actor_type,
        actor_id,
        actor_name,
        actor_role,
        source_app,
        request_id,
        trace_id,
        domain,
        action,
        result,
        severity,
        target_type,
        target_id,
        target_label,
        summary,
        payload,
        changes_json,
        metadata_json,
        ip_address,
        user_agent,
        created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  if (!stmt || typeof stmt.bind !== 'function') return event;
  await stmt.bind(
      event.id,
      event.user_id,
      event.actor_type,
      event.actor_id,
      event.actor_name,
      event.actor_role,
      event.source_app,
      event.request_id,
      event.trace_id,
      event.domain,
      event.action,
      event.result,
      event.severity,
      event.target_type,
      event.target_id,
      event.target_label,
      event.summary,
      event.payload,
      event.changes_json,
      event.metadata_json,
      event.ip_address,
      event.user_agent,
      event.created_at,
    ).run();
  return event;
}

export async function recordAuditEvents(db, events = []) {
  if (!Array.isArray(events) || events.length === 0) return [];
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') return events;
  const statements = events.map((params) => {
    const event = buildAuditEvent(params);
    return db.prepare(
      `INSERT INTO audit_logs (
          id,
          user_id,
          actor_type,
          actor_id,
          actor_name,
          actor_role,
          source_app,
          request_id,
          trace_id,
          domain,
          action,
          result,
          severity,
          target_type,
          target_id,
          target_label,
          summary,
          payload,
          changes_json,
          metadata_json,
          ip_address,
          user_agent,
          created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.id,
      event.user_id,
      event.actor_type,
      event.actor_id,
      event.actor_name,
      event.actor_role,
      event.source_app,
      event.request_id,
      event.trace_id,
      event.domain,
      event.action,
      event.result,
      event.severity,
      event.target_type,
      event.target_id,
      event.target_label,
      event.summary,
      event.payload,
      event.changes_json,
      event.metadata_json,
      event.ip_address,
      event.user_agent,
      event.created_at,
    );
  });
  await db.batch(statements);
  return events;
}

export function setAuditFailureRecorded(c) {
  c.set('auditFailureRecorded', true);
}

export function hasAuditFailureRecorded(c) {
  return Boolean(c.get('auditFailureRecorded'));
}

export function scheduleAuditEvent(c, params = {}) {
  if (!c?.env?.DB) return Promise.resolve(null);
  const scheduler = getAuditScheduler(c);
  const event = buildRequestAuditEvent(c, params);
  scheduler(recordAuditEvent(c.env.DB, event));
  return Promise.resolve(event);
}
