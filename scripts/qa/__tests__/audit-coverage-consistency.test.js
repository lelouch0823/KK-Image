import { describe, expect, it } from 'vitest';
import { collectAuditCoverageViolations, extractScheduledAuditActionsFromSource } from '../check-audit-route-coverage.mjs';

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

  it('has no current audit coverage violations', async () => {
    const violations = await collectAuditCoverageViolations();
    expect(violations).toEqual([]);
  });
});
