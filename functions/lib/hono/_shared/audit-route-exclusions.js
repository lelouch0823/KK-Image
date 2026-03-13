import { normalizeAuditRouteKey } from './audit-route-contract.js';

function defineAuditRouteExclusion(input = {}) {
  const method = String(input.method || '').trim().toUpperCase();
  const path = String(input.path || '').trim();
  const classification = String(input.classification || '').trim();
  const reason = String(input.reason || '').trim();

  if (!method || !path) {
    throw new Error('Audit route exclusion requires method and path');
  }
  if (!classification) {
    throw new Error('Audit route exclusion requires classification');
  }
  if (!reason) {
    throw new Error('Audit route exclusion requires reason');
  }

  return {
    method,
    path,
    classification,
    reason,
    key: normalizeAuditRouteKey({ method, path }),
  };
}

export const ignoredAuditRoutes = [
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/dimensions/impact',
    classification: 'non_mutating_post',
    reason: 'non-mutating impact preview for dimension changes',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/ai/models',
    classification: 'non_mutating_post',
    reason: 'non-mutating AI connectivity and model discovery probe',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/ai/test',
    classification: 'non_mutating_post',
    reason: 'non-mutating AI configuration verification endpoint',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/check-hash',
    classification: 'non_mutating_post',
    reason: 'non-mutating upload deduplication preflight check',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/chat',
    classification: 'non_mutating_post',
    reason: 'non-mutating AI chat interaction outside the operation audit ledger',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/report',
    classification: 'non_mutating_post',
    reason: 'non-mutating AI report generation request',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/stream',
    classification: 'non_mutating_post',
    reason: 'non-mutating AI streaming interaction outside the operation audit ledger',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/check',
    classification: 'non_mutating_post',
    reason: 'non-mutating health or validation probe',
  }),
];

export function getIgnoredAuditRouteKeys() {
  return ignoredAuditRoutes.map((route) => route.key);
}
