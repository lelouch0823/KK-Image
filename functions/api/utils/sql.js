export function placeholders(arr, char = '?') {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map(() => char).join(',');
}

export function inClause(arr, char = '?') {
  const clause = placeholders(arr, char);
  return clause ? `(${clause})` : '(NULL)';
}

// 合法列名模式：仅字母、数字、下划线
const SAFE_COLUMN_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function buildSetClause(record = {}) {
  const entries = Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  for (const [key] of entries) {
    if (!SAFE_COLUMN_RE.test(key)) {
      throw new Error(`Invalid column name: ${key}`);
    }
  }
  return {
    clause: entries.map(([key]) => `${key} = ?`).join(', '),
    values: entries.map(([, value]) => value),
  };
}
