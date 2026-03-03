export function placeholders(arr, char = '?') {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map(() => char).join(',');
}

export function inClause(arr, char = '?') {
  const clause = placeholders(arr, char);
  return clause ? `(${clause})` : '(NULL)';
}
