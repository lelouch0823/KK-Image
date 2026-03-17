function getAbortReason(requestContext) {
  return requestContext?.getAbortReason?.() || requestContext?.signal?.reason || 'aborted';
}

function normalizeConcurrency(value) {
  const num = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(num) || num < 1) return 1;
  return num;
}

async function withToolTimeout(task, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return task();
  }

  let timerId = null;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timerId = setTimeout(() => {
          const error = new Error(`Tool timed out after ${timeoutMs}ms`);
          error.name = 'TimeoutError';
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timerId !== null) clearTimeout(timerId);
  }
}

function createSkippedEnvelope(toolCall, reason) {
  return {
    toolCallId: toolCall.id,
    name: toolCall.name,
    status: 'skipped',
    output: null,
    error: reason,
  };
}

export async function runToolOrchestration({
  toolCalls = [],
  executeTool,
  concurrency = 1,
  timeoutMs = 0,
  requestContext = null,
} = {}) {
  const normalizedCalls = Array.isArray(toolCalls) ? toolCalls : [];
  const results = new Array(normalizedCalls.length);
  const limit = Math.min(normalizeConcurrency(concurrency), normalizedCalls.length || 1);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < normalizedCalls.length) {
      if (requestContext?.signal?.aborted) {
        break;
      }
      const currentIndex = nextIndex;
      nextIndex += 1;
      const toolCall = normalizedCalls[currentIndex];

      try {
        const output = await withToolTimeout(
          () => executeTool(toolCall.name, toolCall.arguments, toolCall),
          timeoutMs
        );
        results[currentIndex] = {
          toolCallId: toolCall.id,
          name: toolCall.name,
          status: 'success',
          output,
          error: null,
        };
      } catch (error) {
        if (error?.name === 'TimeoutError') {
          results[currentIndex] = {
            toolCallId: toolCall.id,
            name: toolCall.name,
            status: 'timeout',
            output: null,
            error: error.message,
          };
          continue;
        }

        // Check if this was an abort - return 'aborted' status, not 'success'
        if (requestContext?.signal?.aborted || error?.name === 'AbortError') {
          results[currentIndex] = {
            toolCallId: toolCall.id,
            name: toolCall.name,
            status: 'aborted',
            output: null,
            error: getAbortReason(requestContext),
          };
          break;
        }

        results[currentIndex] = {
          toolCallId: toolCall.id,
          name: toolCall.name,
          status: 'failure',
          output: null,
          error: error?.message || 'Tool execution failed',
        };
      }
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));

  if (requestContext?.signal?.aborted) {
    const reason = getAbortReason(requestContext);
    for (let i = 0; i < normalizedCalls.length; i += 1) {
      if (!results[i]) {
        results[i] = createSkippedEnvelope(normalizedCalls[i], reason);
      }
    }
  }

  return {
    results,
  };
}
