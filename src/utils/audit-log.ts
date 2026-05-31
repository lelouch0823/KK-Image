import { safeParseJson } from '@/utils/json.js';

/** 审计日志行数据结构 */
export interface AuditRow {
  summary?: string;
  actor_name?: string;
  actor_id?: string;
  user_id?: string;
  action?: string;
  target_label?: string;
  target_id?: string;
  target_type?: string;
  changes_json?: string | Record<string, unknown>;
  metadata_json?: string | Record<string, unknown>;
  payload?: string | Record<string, unknown>;
  result?: string;
  severity?: string;
  [key: string]: unknown;
}

/** 归一化后的审计日志行 */
export interface NormalizedAuditRow extends AuditRow {
  actor_display: string;
  summary_display: string;
  changes_display: Record<string, unknown> | null;
  metadata_display: Record<string, unknown> | null;
  result: string;
  severity: string;
}

export function parseAuditJson(value: unknown, fallback: Record<string, unknown> | null = null): Record<string, unknown> | null {
  if (!value) return fallback;
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return safeParseJson(value, fallback) as Record<string, unknown> | null;
}

export function formatAuditSummary(row: AuditRow = {}): string {
  if (row.summary) return row.summary;
  const actor = row.actor_name || row.actor_id || row.user_id || 'Unknown';
  const action = row.action || 'unknown action';
  const target = row.target_label || row.target_id || row.target_type || 'target';
  return `${actor} ${action} ${target}`;
}

export function normalizeAuditRow(row: AuditRow = {}): NormalizedAuditRow {
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

export function formatAuditDetails(row: AuditRow = {}): string {
  const normalized = normalizeAuditRow(row);
  if (normalized.changes_display) {
    return JSON.stringify(normalized.changes_display);
  }
  if (normalized.metadata_display) {
    return JSON.stringify(normalized.metadata_display);
  }
  return '-';
}
