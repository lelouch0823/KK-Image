export function placeholders(arr, char = '?') {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map(() => char).join(',');
}

export function inClause(arr, char = '?') {
  const clause = placeholders(arr, char);
  return clause ? `(${clause})` : '(NULL)';
}

export function buildSetClause(record = {}) {
  const entries = Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  return {
    clause: entries.map(([key]) => `${key} = ?`).join(', '),
    values: entries.map(([, value]) => value),
  };
}
