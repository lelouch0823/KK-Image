import { describe, expect, it } from 'vitest';
import {
  buildAuditCoverageReport,
  collectActiveRouteLegacyAuditUsage,
  ignoredAuditRoutes,
  collectAuditCoverageViolations,
  extractScheduledAuditActionsFromSource,
  extractScheduledAuditPropertyLiterals,
} from '../check-audit-route-coverage.mjs';

describe('audit coverage consistency helpers', () => {
  it('extracts action values from scheduleAuditEvent calls', () => {
    const source = `
      scheduleAuditEvent(c, {
        action: forceStatusTransition ? 'order.status.force_change' : 'order.status.change',
      });
      scheduleAuditEvent(c, {
        action: 'order.update',
      });
    `;

    const actions = extractScheduledAuditActionsFromSource(source);
    expect(actions.has('order.status.force_change')).toBe(true);
    expect(actions.has('order.status.change')).toBe(true);
    expect(actions.has('order.update')).toBe(true);
  });

  it('extracts domain, targetType, and severity values from scheduleAuditEvent calls', () => {
    const source = `
      scheduleAuditEvent(c, {
        domain: 'orders',
        targetType: 'order',
        severity: forceStatusTransition ? 'high' : 'normal',
      });
    `;

    expect(extractScheduledAuditPropertyLiterals(source, 'domain').has('orders')).toBe(true);
    expect(extractScheduledAuditPropertyLiterals(source, 'targetType').has('order')).toBe(true);
    expect(extractScheduledAuditPropertyLiterals(source, 'severity').has('high')).toBe(true);
    expect(extractScheduledAuditPropertyLiterals(source, 'severity').has('normal')).toBe(true);
  });

  it('has no current audit coverage violations', async () => {
    const violations = await collectAuditCoverageViolations();
    expect(violations).toEqual([]);
  }, 15000);

  it('has no legacy logAudit usage in active hono write routes', async () => {
    const legacyUsages = await collectActiveRouteLegacyAuditUsage();
    expect(legacyUsages).toEqual([]);
  });

  it('tracks excluded write routes with explicit policy metadata', () => {
    expect(ignoredAuditRoutes.length).toBeGreaterThan(0);
    expect(ignoredAuditRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'POST /chat',
          reason: expect.stringContaining('non-mutating'),
          classification: 'non_mutating_post',
        }),
        expect.objectContaining({
          key: 'POST /report',
          reason: expect.stringContaining('non-mutating'),
          classification: 'non_mutating_post',
        }),
      ])
    );
    expect(ignoredAuditRoutes.map((route) => route.key)).toContain('POST /check-hash');
  });

  it('builds a machine-readable audit coverage report', async () => {
    const report = await buildAuditCoverageReport();

    expect(report).toEqual(
      expect.objectContaining({
        routeFileCount: expect.any(Number),
        ignoredRoutes: expect.any(Array),
        legacyAuditRouteFiles: expect.any(Array),
        violations: expect.any(Array),
      })
    );
    expect(report.routeFileCount).toBeGreaterThan(0);
    expect(report.ignoredRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'POST /chat', classification: 'non_mutating_post' }),
      ])
    );
  });
});
