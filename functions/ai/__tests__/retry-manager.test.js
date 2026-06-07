import { describe, expect, it, vi } from 'vitest';
import { classifyAIError, executeWithRetry } from '../retry-manager.js';

describe('retry-manager', () => {
  it('classifies 429 and network errors as retryable', () => {
    expect(classifyAIError(new Error('AI API error (429)'))).toEqual(
      expect.objectContaining({ retryable: true })
    );
    expect(classifyAIError(new TypeError('fetch failed'))).toEqual(
      expect.objectContaining({ retryable: true })
    );
  });

  it('does not retry validation-style 400 errors', async () => {
    const task = vi.fn(async () => {
      throw new Error('AI API error (400) [model:m]: invalid parameter');
    });

    await expect(executeWithRetry(task, { retries: 2, baseDelayMs: 1 })).rejects.toThrow(/400/);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures with bounded attempts', async () => {
    let attempts = 0;
    const task = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('AI API error (503) [model:m]: overloaded');
      return 'ok';
    });

    const result = await executeWithRetry(task, { retries: 2, baseDelayMs: 1, jitterMs: 0 });
    expect(result).toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });
});
