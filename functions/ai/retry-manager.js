function toErrorMessage(error) {
  return String(error?.message || error || '');
}

function parseStatusFromMessage(message) {
  const match = String(message || '').match(/\((\d{3})\)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function classifyAIError(error) {
  const message = toErrorMessage(error);
  const status = parseStatusFromMessage(message);
  const isNetworkError =
    error instanceof TypeError || /fetch failed|network|timeout/i.test(message);
  const retryableStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
  const retryable = isNetworkError || (status !== null && retryableStatuses.has(status));

  return {
    retryable,
    status,
    isNetworkError,
    code: retryable ? 'retryable' : 'non_retryable',
  };
}

function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithRetry(task, options = {}) {
  const retries = Math.max(0, Number.parseInt(String(options.retries ?? 0), 10) || 0);
  const baseDelayMs = Math.max(0, Number.parseInt(String(options.baseDelayMs ?? 0), 10) || 0);
  const jitterMs = Math.max(0, Number.parseInt(String(options.jitterMs ?? 0), 10) || 0);
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;

  let attempt = 0;
  while (true) {
    try {
      return await task(attempt);
    } catch (error) {
      const classification = classifyAIError(error);
      if (!classification.retryable || attempt >= retries) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt + jitterMs;
      if (onRetry) {
        onRetry({
          attempt: attempt + 1,
          nextDelayMs: delay,
          error,
          classification,
        });
      }
      await sleep(delay);
      attempt += 1;
    }
  }
}
