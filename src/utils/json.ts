export function safeParseJson<T = unknown>(value: unknown, fallback: T | null = null): T | null {
  if (typeof value !== 'string') {
    return (value as T | null) ?? fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseJsonArray<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  const parsed = safeParseJson<T[]>(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function parseJsonObject(value: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  const parsed = safeParseJson<Record<string, unknown>>(value, fallback);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return fallback;
  }
  return parsed;
}
