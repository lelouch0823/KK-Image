import { generateId } from '../api/utils/id.js';

function createAbortError(reason) {
  const error = new Error(`AI request aborted: ${reason}`);
  error.name = 'AbortError';
  error.code = 'AI_REQUEST_ABORTED';
  error.reason = reason;
  return error;
}

export function createAIRequestContext(input = {}) {
  const controller =
    input.controller instanceof AbortController ? input.controller : new AbortController();
  let abortReason = null;
  const spans = [];
  const requestId = input.requestId || generateId();
  const traceId = input.traceId || generateId();

  // Helper to set abort reason only if not already set (sticky behavior)
  const setAbortReason = (reason) => {
    if (abortReason === null) {
      abortReason = reason;
    }
  };

  // Adopt external signal if provided
  const externalSignal = input.signal;
  if (externalSignal instanceof AbortSignal) {
    // If already aborted, capture the reason and abort our controller immediately
    if (externalSignal.aborted) {
      const reason = externalSignal.reason || 'external_abort';
      setAbortReason(reason);
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    } else {
      // Forward external aborts to our controller
      externalSignal.addEventListener('abort', () => {
        setAbortReason(externalSignal.reason || 'external_abort');
        if (!controller.signal.aborted) {
          controller.abort(externalSignal.reason);
        }
      });
    }
  }

  return {
    requestId,
    traceId,
    userId: input.userId || null,
    routeType: input.routeType || null,
    deadline: input.deadline || null,
    signal: controller.signal,
    abort(reason = 'aborted') {
      setAbortReason(reason);
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
