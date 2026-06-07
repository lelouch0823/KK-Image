import { Hono } from 'hono';
import { OutboxReplayService } from '../../../../services/OutboxReplayService.js';
import { requirePermission } from '../../middleware/auth.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { ForbiddenError } from '../../errors.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/dry-run',
    domain: 'audit-replay',
    action: 'outbox.replay.dry_run',
    severity: 'high',
    targetType: 'outbox_event',
    runtimeAssertionLevel: 'runtime',
  },
  {
    method: 'POST',
    path: '/execute',
    domain: 'audit-replay',
    action: 'outbox.replay.execute',
    severity: 'critical',
    targetType: 'outbox_event',
    runtimeAssertionLevel: 'runtime',
    highRisk: true,
  },
]);

function assertReplayExecuteAdmin(user = {}) {
  if (user?.role === 'admin' || user?.type === 'admin') {
    return;
  }

  throw new ForbiddenError('仅管理员可以执行重放');
}

app.post('/dry-run', requirePermission('audit:read'), async (c) => {
  const service = new OutboxReplayService(c.env.DB, { env: c.env });
  const user = c.get('user') || {};
  const body = await c.req.json();
  const result = await service.dryRun({
    scopeType: body.scopeType,
    scopeId: body.scopeId,
    consumerName: body.consumerName || null,
    requestedBy: user.id || null,
  });

  scheduleAuditEvent(c, {
    domain: 'audit-replay',
    action: 'outbox.replay.dry_run',
    result: 'success',
    severity: 'high',
    targetType: 'outbox_event',
    targetId: body.scopeId,
    target_label: body.scopeId,
    summary: `Dry-ran replay for ${body.scopeType}:${body.scopeId}`,
    metadata: { consumerName: body.consumerName || null, runId: result?.runId || null },
  });

  return c.json({ success: true, data: result });
});

app.post('/execute', requirePermission('audit:read'), async (c) => {
  const service = new OutboxReplayService(c.env.DB, { env: c.env });
  const user = c.get('user') || {};
  assertReplayExecuteAdmin(user);
  const body = await c.req.json();
  const result = await service.executeReplay({
    scopeType: body.scopeType,
    scopeId: body.scopeId,
    consumerName: body.consumerName || null,
    requestedBy: user.id || null,
  });

  scheduleAuditEvent(c, {
    domain: 'audit-replay',
    action: 'outbox.replay.execute',
    result: 'success',
    severity: 'critical',
    targetType: 'outbox_event',
    targetId: body.scopeId,
    target_label: body.scopeId,
    summary: `Executed replay for ${body.scopeType}:${body.scopeId}`,
    metadata: { consumerName: body.consumerName || null, runId: result?.runId || null },
  });

  return c.json({ success: true, data: result });
});

export default app;
