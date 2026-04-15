export function safeParseJson(value, fallback = null) {
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
  const parsed = safeParseJson(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function parseJsonObject(value, fallback = {}) {
  const parsed = safeParseJson(value, fallback);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return fallback;
  }
  return parsed;
}
