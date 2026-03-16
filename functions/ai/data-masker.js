const SENSITIVE_KEY_PATTERN = /password|token|secret|cookie|authorization|jwt|api[-_]?key/i;

export function maskSensitiveData(input) {
  if (Array.isArray(input)) return input.map(maskSensitiveData);
  if (!input || typeof input !== 'object') return input;

  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = maskSensitiveData(value);
  }
  return result;
}
