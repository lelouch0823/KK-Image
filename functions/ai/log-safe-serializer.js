import { maskSensitiveData } from './data-masker.js';

export function serializeLogSafe({ payload, maxLength = 2000 } = {}) {
  const masked = maskSensitiveData(payload);
  const raw = JSON.stringify(masked);
  if (raw.length <= maxLength) {
    return { serialized: raw, truncated: false };
  }
  return {
    serialized: `${raw.slice(0, maxLength)}...`,
    truncated: true,
  };
}
