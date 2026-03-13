import { describe, expect, it } from 'vitest';
import { formatAuditDetails, normalizeAuditRow } from '@/utils/audit-log';

describe('AuditLogs behavior', () => {
  it('normalizes structured rows without throwing on malformed legacy payloads', () => {
    const row = normalizeAuditRow({
      actor_name: 'Admin',
      action: 'order.update',
      payload: '{bad-json',
      metadata_json: '{still-bad',
      changes_json: null,
    });

    expect(row.actor_display).toBe('Admin');
    expect(row.metadata_display).toBe(null);
    expect(row.summary_display).toContain('order.update');
  });

  it('formats details from changes_json first', () => {
    const details = formatAuditDetails({
      changes_json: '{"before":{"status":"pending"},"after":{"status":"done"}}',
      metadata_json: '{"reason":"manual"}',
    });

    expect(details).toContain('"after"');
    expect(details).toContain('"done"');
  });
});
