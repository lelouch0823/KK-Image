/**
 * AI Request Executor
 *
 * Unified executor for AI provider requests with:
 * - Abort-aware fetch and retry
 * - Model selection and rate-limit switch recursion
 * - Normalized result metadata
 */

import {
  getNextAvailableModelIndex,
  isModelAvailable,
  markModelRateLimited,
  parseHealthWindow,
  parseModels,
  recordModelHealth,
  resolveModelOrder,
} from './model-policy.js';
import { classifyAIError } from './retry-manager.js';
import { createStructuredAbortError } from './request-context.js';

/**
 * Sleep with abort support
 * @param {number} ms - Milliseconds to sleep
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createStructuredAbortError(signal.reason || 'aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(createStructuredAbortError(signal.reason || 'aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Check if signal is aborted and throw if so
 * @param {AbortSignal} signal - Abort signal to check
 * @throws {AbortError} If signal is aborted
 */
function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createStructuredAbortError(signal.reason || 'aborted');
  }
}

/**
 * Get rate limit status from response headers
 * @param {Response} response - Fetch response
 * @returns {Object} Rate limit info
 */
function getRateLimitStatus(response) {
  return {
    remaining: parseInt(response.headers.get('modelscope-ratelimit-requests-remaining') || '9999'),
    limit: parseInt(response.headers.get('modelscope-ratelimit-requests-limit') || '9999'),
    modelRemaining: parseInt(response.headers.get('modelscope-ratelimit-model-requests-remaining') || '9999'),
    modelLimit: parseInt(response.headers.get('modelscope-ratelimit-model-requests-limit') || '9999'),
  };
}

/**
 * Execute an AI request with abort support, retry, and model switching
 *
 * @param {Object} options
 * @param {Object} options.env - Environment variables
 * @param {number} options.modelIndex - Current model index
 * @param {AbortSignal} [options.signal] - Abort signal
 * @param {Function} options.requestFn - Request function ({ model, apiKey, apiUrl, signal }) => Promise<Response>
 * @param {number} [options._depth] - Recursion depth for model switching
 * @returns {Promise<{ response: Response, model: string, switched: boolean, rateLimit: Object, retryCount: number }>}
 */
export async function executeAIRequest({
  env,
  modelIndex,
  signal,
  requestFn,
  _depth = 0,
}) {
  // Preflight abort check
  throwIfAborted(signal);

  const { AI_API_KEY, AI_API_URL, AI_MODELS, AI_MODEL, AI_MODEL_SWITCH_THRESHOLD } = env;
  const threshold = parseInt(AI_MODEL_SWITCH_THRESHOLD || '5');
  const healthWindow = parseHealthWindow(env?.AI_MODEL_HEALTH_WINDOW);
  const retryAttempts = parseInt(env?.AI_RETRY_ATTEMPTS || '0', 10);
  const retryBaseDelayMs = parseInt(env?.AI_RETRY_BASE_DELAY_MS || '0', 10);
  const retryJitterMs = parseInt(env?.AI_RETRY_JITTER_MS || '0', 10);

  // Parse model list
  const models = parseModels(AI_MODELS);
  if (models.length === 0 && AI_MODEL) {
    models.push(AI_MODEL);
  }
  const orderedModels = resolveModelOrder(models, env);

  if (!AI_API_KEY || !AI_API_URL || orderedModels.length === 0) {
    throw new Error('AI configuration missing');
  }

  // Smart model selection
  let activeIndex = modelIndex;
  if (!isModelAvailable(orderedModels[activeIndex])) {
    const nextIndex = getNextAvailableModelIndex(orderedModels, activeIndex);
    if (nextIndex !== -1) {
      activeIndex = nextIndex;
    }
  }

  const currentModel = orderedModels[activeIndex];
  const cleanApiUrl = AI_API_URL.replace(/\/+$/, '');
  let retryCount = 0;

  // Execute request
  const requestStartedAt = Date.now();
  let response;

  try {
    // Retry loop with abort support
    let attempt = 0;
    while (true) {
      // Check abort before each attempt
      throwIfAborted(signal);

      try {
        response = await requestFn({
          model: currentModel,
          apiKey: AI_API_KEY,
          apiUrl: cleanApiUrl,
          signal,
        });
        break; // Success, exit retry loop
      } catch (error) {
        // Check if aborted during fetch
        if (signal?.aborted) {
          throw createStructuredAbortError(signal.reason || 'aborted');
        }

        const classification = classifyAIError(error);
        if (!classification.retryable || attempt >= retryAttempts) {
          throw error;
        }

        // Calculate backoff delay
        const delay = retryBaseDelayMs * (2 ** attempt) + retryJitterMs;
        retryCount += 1;

        // Wait with abort support
        await sleep(delay, signal);

        attempt += 1;
      }
    }
  } catch (error) {
    const latency = Date.now() - requestStartedAt;
    recordModelHealth(currentModel, { ok: false, latencyMs: latency }, healthWindow);
    throw error;
  }

  const latency = Date.now() - requestStartedAt;
  recordModelHealth(currentModel, { ok: response.ok, latencyMs: latency }, healthWindow);

  // Check rate limit status
  const rateLimit = getRateLimitStatus(response);

  // Low quota warning switch
  if (rateLimit.modelRemaining < threshold) {
    markModelRateLimited(currentModel);
    const nextIndex = getNextAvailableModelIndex(orderedModels, activeIndex);
    if (nextIndex !== -1) {
      // Check abort before model switch
      throwIfAborted(signal);

      console.log(`[AI] Model ${currentModel} low quota (${rateLimit.modelRemaining}), switching...`);
      const switchedResult = await executeAIRequest({
        env,
        modelIndex: nextIndex,
        signal,
        requestFn,
        _depth: _depth + 1,
      });
      return {
        ...switchedResult,
        retryCount: retryCount + (switchedResult.retryCount || 0),
      };
    }
  }

  // 429 rate limit switch
  if (!response.ok && response.status === 429) {
    markModelRateLimited(currentModel);
    const nextIndex = getNextAvailableModelIndex(orderedModels, activeIndex);
    if (nextIndex !== -1) {
      // Check abort before model switch
      throwIfAborted(signal);

      console.log(`[AI] Model ${currentModel} 429 rate limited, switching...`);
      const switchedResult = await executeAIRequest({
        env,
        modelIndex: nextIndex,
        signal,
        requestFn,
        _depth: _depth + 1,
      });
      return {
        ...switchedResult,
        retryCount: retryCount + (switchedResult.retryCount || 0),
      };
    }

    const errorBody = await response.text();
    throw new Error(`AI API error (429) [model:${currentModel}]: ${errorBody}`);
  }

  // Non-OK response
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI API error (${response.status}) [model:${currentModel}]: ${errorBody}`);
  }

  return {
    response,
    model: currentModel,
    switched: activeIndex > 0,
    rateLimit,
    retryCount,
  };
}
