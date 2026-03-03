export function safeJsonParse(value, fallback = null) {
  if (typeof value !== 'string') {
    return value ?? fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseJsonArray(value, fallback = []) {
  const parsed = safeJsonParse(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function parseJsonObject(value, fallback = {}) {
  const parsed = safeJsonParse(value, fallback);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return fallback;
  }
  return parsed;
}
