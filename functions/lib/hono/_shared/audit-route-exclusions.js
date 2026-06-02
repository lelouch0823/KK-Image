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
  // ERP sync
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/connections/:id/test',
    classification: 'non_mutating_post',
    reason: 'non-mutating ERP connection test probe',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/connections/:id/sync',
    classification: 'pending_audit',
    reason: 'ERP sync trigger — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/connections/:id/webhook',
    classification: 'non_mutating_post',
    reason: 'non-mutating ERP webhook endpoint',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/connections',
    classification: 'pending_audit',
    reason: 'ERP connection creation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'PUT',
    path: '/connections/:id',
    classification: 'pending_audit',
    reason: 'ERP connection update — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'DELETE',
    path: '/connections/:id',
    classification: 'pending_audit',
    reason: 'ERP connection deletion — audit declaration pending',
  }),
  // Categories
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/products',
    classification: 'pending_audit',
    reason: 'category product assignment — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'DELETE',
    path: '/:id',
    classification: 'pending_audit',
    reason: 'category deletion — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/product/:productId',
    classification: 'pending_audit',
    reason: 'category product batch operation — audit declaration pending',
  }),
  // Customers
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/batch/tags',
    classification: 'pending_audit',
    reason: 'customer batch tag operation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/batch/export',
    classification: 'non_mutating_post',
    reason: 'non-mutating customer batch export',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/import/confirm',
    classification: 'pending_audit',
    reason: 'customer import confirmation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/communications',
    classification: 'pending_audit',
    reason: 'customer communication creation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'DELETE',
    path: '/:id/communications/:commId',
    classification: 'pending_audit',
    reason: 'customer communication deletion — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/tags',
    classification: 'pending_audit',
    reason: 'customer tag addition — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'DELETE',
    path: '/:id/tags/:tagName',
    classification: 'pending_audit',
    reason: 'customer tag removal — audit declaration pending',
  }),
  // Feature flags
  defineAuditRouteExclusion({
    method: 'PATCH',
    path: '/:key',
    classification: 'pending_audit',
    reason: 'feature flag update — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/',
    classification: 'pending_audit',
    reason: 'feature flag creation — audit declaration pending',
  }),
  // OAuth
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/apps',
    classification: 'pending_audit',
    reason: 'OAuth app creation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'PUT',
    path: '/apps/:id',
    classification: 'pending_audit',
    reason: 'OAuth app update — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'DELETE',
    path: '/apps/:id',
    classification: 'pending_audit',
    reason: 'OAuth app deletion — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/apps/:id/regenerate-secret',
    classification: 'pending_audit',
    reason: 'OAuth secret regeneration — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/apps/:id/revoke-tokens',
    classification: 'pending_audit',
    reason: 'OAuth token revocation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/authorize',
    classification: 'non_mutating_post',
    reason: 'non-mutating OAuth authorization flow',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/token',
    classification: 'non_mutating_post',
    reason: 'non-mutating OAuth token exchange',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/revoke',
    classification: 'non_mutating_post',
    reason: 'non-mutating OAuth token revocation',
  }),
  // Order logistics and payments
  defineAuditRouteExclusion({
    method: 'PATCH',
    path: '/:id/logistics',
    classification: 'pending_audit',
    reason: 'order logistics update — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/payments',
    classification: 'pending_audit',
    reason: 'order payment creation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'DELETE',
    path: '/:id/payments/:paymentId',
    classification: 'pending_audit',
    reason: 'order payment deletion — audit declaration pending',
  }),
  // Stocktakes
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/',
    classification: 'pending_audit',
    reason: 'stocktake creation — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'PATCH',
    path: '/:id',
    classification: 'pending_audit',
    reason: 'stocktake update — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/items',
    classification: 'pending_audit',
    reason: 'stocktake item addition — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/adjust',
    classification: 'pending_audit',
    reason: 'stocktake adjustment — audit declaration pending',
  }),
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/:id/cancel',
    classification: 'pending_audit',
    reason: 'stocktake cancellation — audit declaration pending',
  }),
  // Webhooks
  defineAuditRouteExclusion({
    method: 'POST',
    path: '/logs/:logId/retry',
    classification: 'non_mutating_post',
    reason: 'non-mutating webhook log retry',
  }),
];
