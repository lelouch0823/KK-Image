const VALID_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const VALID_SEVERITIES = new Set(['normal', 'high', 'critical']);
const VALID_RUNTIME_ASSERTION_LEVELS = new Set(['static', 'runtime']);

export function normalizeAuditRouteMethod(method) {
  return String(method || '')
    .trim()
    .toUpperCase();
}

export function normalizeAuditRouteKey({ method, path }) {
  return `${normalizeAuditRouteMethod(method)} ${String(path || '').trim()}`;
}

export function declareAuditRoute(input = {}) {
  const method = normalizeAuditRouteMethod(input.method);
  const path = String(input.path || '').trim();
  const domain = String(input.domain || '').trim();
  const action = String(input.action || '').trim();
  const severity = String(input.severity || 'normal').trim();
  const targetType = String(input.targetType || '').trim();

  if (!VALID_METHODS.has(method)) {
    throw new Error(`Invalid audit route method: ${input.method}`);
  }
  if (!path) {
    throw new Error('Audit route declaration requires path');
  }
  if (!domain) {
    throw new Error('Audit route declaration requires domain');
  }
  if (!action) {
    throw new Error('Audit route declaration requires action');
  }
  if (!VALID_SEVERITIES.has(severity)) {
    throw new Error(`Invalid audit route severity: ${severity}`);
  }
  if (!targetType) {
    throw new Error('Audit route declaration requires targetType');
  }
  const runtimeAssertionLevel = String(input.runtimeAssertionLevel || 'static').trim();
  if (!VALID_RUNTIME_ASSERTION_LEVELS.has(runtimeAssertionLevel)) {
    throw new Error(`Invalid audit runtime assertion level: ${runtimeAssertionLevel}`);
  }

  return {
    method,
    path,
    domain,
    action,
    severity,
    targetType,
    resultModes:
      Array.isArray(input.resultModes) && input.resultModes.length > 0
        ? [...new Set(input.resultModes)]
        : ['success', 'denied', 'failed'],
    phase: input.phase || 'phase2',
    excludedReason: input.excludedReason || null,
    runtimeAssertionLevel,
    highRisk: Boolean(input.highRisk),
    key: normalizeAuditRouteKey({ method, path }),
  };
}

export function declareAuditRoutes(routes = []) {
  return routes.map((route) => declareAuditRoute(route));
}
