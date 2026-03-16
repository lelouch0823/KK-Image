import { describe, expect, it } from 'vitest';
import { maskSensitiveData } from '../data-masker.js';
import { serializeLogSafe } from '../log-safe-serializer.js';

describe('ai data masking and log serialization', () => {
  it('redacts sensitive fields from tool outputs', () => {
    const result = maskSensitiveData({
      customer: 'Alice',
      token: 'secret-token',
      nested: { apiKey: 'sk-123', keep: 'ok' },
    });

    expect(result.token).toBe('[REDACTED]');
    expect(result.nested.apiKey).toBe('[REDACTED]');
    expect(result.nested.keep).toBe('ok');
  });

  it('truncates oversized payloads for logs', () => {
    const result = serializeLogSafe({
      payload: { content: 'x'.repeat(200) },
      maxLength: 40,
    });

    expect(result.truncated).toBe(true);
    expect(String(result.serialized).length).toBeLessThanOrEqual(80);
  });
});
