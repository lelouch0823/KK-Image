function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function createAbortError(reason) {
  const error = new Error(`AI request aborted: ${reason}`);
  error.name = 'AbortError';
  error.code = 'AI_REQUEST_ABORTED';
  error.reason = reason;
  return error;
}

export function createAIRequestContext(input = {}) {
  const controller = input.controller instanceof AbortController ? input.controller : new AbortController();
  let abortReason = null;
  const spans = [];
  const requestId = input.requestId || createId('req');
  const traceId = input.traceId || createId('trace');

  return {
    requestId,
    traceId,
    userId: input.userId || null,
    routeType: input.routeType || null,
    deadline: input.deadline || null,
    signal: controller.signal,
    abort(reason = 'aborted') {
      abortReason = reason;
      controller.abort(reason);
    },
    getAbortReason() {
      return abortReason || controller.signal.reason || null;
    },
    addSpan(span = {}) {
      spans.push({
        ...span,
        requestId,
        createdAt: Number(span.createdAt || Date.now()),
      });
    },
    getSpans() {
      return [...spans];
    },
  };
}

export function throwIfAborted(signal, getReason = () => signal?.reason || 'aborted') {
  if (!signal?.aborted) return;
  throw createAbortError(getReason());
}

export function createStructuredAbortError(reason = 'aborted') {
  return createAbortError(reason);
}
