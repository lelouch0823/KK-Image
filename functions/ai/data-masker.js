import { SENSITIVE_KEY_PATTERN } from '../api/utils/sanitize.js';

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
