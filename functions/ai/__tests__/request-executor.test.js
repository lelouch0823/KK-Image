import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAIRequest } from '../request-executor.js';

// Mock dependencies
vi.mock('../model-policy.js', () => ({
  parseModels: vi.fn((modelsEnv) => {
    if (!modelsEnv) return [];
    return String(modelsEnv).split(',').map((m) => m.trim()).filter(Boolean);
  }),
  resolveModelOrder: vi.fn((models) => models),
  isModelAvailable: vi.fn(() => true),
  getNextAvailableModelIndex: vi.fn((models, currentIndex) => {
    if (currentIndex + 1 < models.length) return currentIndex + 1;
    return -1;
  }),
  markModelRateLimited: vi.fn(),
  recordModelHealth: vi.fn(),
  parseHealthWindow: vi.fn(() => 20),
}));

describe('request-executor', () => {
  const createMockEnv = (overrides = {}) => ({
    AI_API_KEY: 'test-key',
    AI_API_URL: 'https://api.test.com/v1',
    AI_MODELS: 'model-a,model-b',
    AI_MODEL: 'model-a',
    AI_RETRY_ATTEMPTS: '2',
    AI_RETRY_BASE_DELAY_MS: '10', // Small for tests
    AI_RETRY_JITTER_MS: '0',
    ...overrides,
  });

  const createOkResponse = (data = {}) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const createErrorResponse = (status = 503) =>
    new Response('Service Unavailable', { status });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('abort propagation', () => {
    it('passes the request signal into requestFn', async () => {
      const controller = new AbortController();
      let capturedSignal = null;

      await executeAIRequest({
        env: createMockEnv(),
        modelIndex: 0,
        signal: controller.signal,
        requestFn: vi.fn(async ({ signal }) => {
          capturedSignal = signal;
          return createOkResponse({ choices: [] });
        }),
      });

      expect(capturedSignal).toBe(controller.signal);
    });

    it('throws immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('client_disconnect');

      const requestFn = vi.fn();

      await expect(
        executeAIRequest({
          env: createMockEnv(),
          modelIndex: 0,
          signal: controller.signal,
          requestFn,
        })
      ).rejects.toThrow(/aborted/);

      expect(requestFn).not.toHaveBeenCalled();
    });
  });

  describe('abort during retry', () => {
    it('stops retrying when the signal aborts during backoff', async () => {
      const controller = new AbortController();

      let attemptCount = 0;
      const requestFn = vi.fn(async () => {
        attemptCount += 1;
        // Abort on first failure, retry should not happen
        if (attemptCount === 1) {
          setTimeout(() => controller.abort('client_disconnect'), 5);
          throw new Error('Network error (503)');
        }
        throw new Error('Should not reach here');
      });

      const env = createMockEnv({
        AI_RETRY_ATTEMPTS: '3',
        AI_RETRY_BASE_DELAY_MS: '100', // Will be interrupted
      });

      await expect(
        executeAIRequest({
          env,
          modelIndex: 0,
          signal: controller.signal,
          requestFn,
        })
      ).rejects.toThrow(/aborted/);

      expect(attemptCount).toBe(1);
    });
  });

  describe('abort before model switch', () => {
    it('stops model switch recursion when signal aborts', async () => {
      const controller = new AbortController();
      controller.abort('client_disconnect');

      const { isModelAvailable, getNextAvailableModelIndex } = await import('../model-policy.js');
      isModelAvailable.mockReturnValueOnce(false).mockReturnValue(true);
      getNextAvailableModelIndex.mockReturnValue(1);

      const requestFn = vi.fn();

      await expect(
        executeAIRequest({
          env: createMockEnv(),
          modelIndex: 0,
          signal: controller.signal,
          requestFn,
        })
      ).rejects.toThrow(/aborted/);

      // Should not even try to fetch since signal is aborted
      expect(requestFn).not.toHaveBeenCalled();
    });
  });

  describe('retry behavior', () => {
    it('successful retry records retry count', async () => {
      let attempts = 0;
      const requestFn = vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('Network error (503)');
        }
        return createOkResponse({ choices: [] });
      });

      const result = await executeAIRequest({
        env: createMockEnv({
          AI_RETRY_ATTEMPTS: '2',
          AI_RETRY_BASE_DELAY_MS: '10',
        }),
        modelIndex: 0,
        requestFn,
      });

      expect(result.retryCount).toBe(1);
      expect(attempts).toBe(2);
    });
  });

  describe('result metadata', () => {
    it('returns normalized metadata including model, switched, rateLimit, retryCount', async () => {
      const requestFn = vi.fn(async () =>
        createOkResponse({ choices: [{ message: { content: 'ok' } }] })
      );

      const result = await executeAIRequest({
        env: createMockEnv({ AI_MODELS: 'model-a' }),
        modelIndex: 0,
        requestFn,
      });

      expect(result.model).toBe('model-a');
      expect(result.switched).toBe(false);
      expect(result.retryCount).toBe(0);
      expect(result.rateLimit).toBeDefined();
    });
  });
});
