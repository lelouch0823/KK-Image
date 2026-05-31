export function safeParseJson(value: any, fallback: any = null): any {
  if (typeof value !== 'string') {
    return value ?? fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseJsonArray(value: any, fallback: any[] = []): any[] {
  const parsed = safeParseJson(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function parseJsonObject(value: any, fallback: Record<string, any> = {}): Record<string, any> {
  const parsed = safeParseJson(value, fallback);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return fallback;
  }
  return parsed;
}
