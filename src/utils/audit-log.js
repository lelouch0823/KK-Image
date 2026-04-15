import { safeParseJson } from '@/utils/json.js';

export function parseAuditJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  return safeParseJson(value, fallback);
}

export function formatAuditSummary(row = {}) {
  if (row.summary) return row.summary;
  const actor = row.actor_name || row.actor_id || row.user_id || 'Unknown';
  const action = row.action || 'unknown action';
  const target = row.target_label || row.target_id || row.target_type || 'target';
  return `${actor} ${action} ${target}`;
}

export function normalizeAuditRow(row = {}) {
  const changes = parseAuditJson(row.changes_json, null);
  const metadata = parseAuditJson(row.metadata_json, parseAuditJson(row.payload, null));
  return {
    ...row,
    actor_display: row.actor_name || row.actor_id || row.user_id || '-',
    summary_display: formatAuditSummary(row),
    changes_display: changes,
    metadata_display: metadata,
    result: row.result || 'success',
    severity: row.severity || 'normal',
  };
}

export function formatAuditDetails(row = {}) {
  const normalized = normalizeAuditRow(row);
  if (normalized.changes_display) {
    return JSON.stringify(normalized.changes_display);
  }
  if (normalized.metadata_display) {
    return JSON.stringify(normalized.metadata_display);
  }
  return '-';
}
