import { describe, expect, it } from 'vitest';
import { createAIRequestContext, throwIfAborted } from '../request-context.js';

describe('request-context', () => {
  it('creates a stable request context with request and trace ids', () => {
    const context = createAIRequestContext({ userId: 'u-1', routeType: 'stream' });

    expect(context.requestId).toBeTruthy();
    expect(context.traceId).toBeTruthy();
    expect(context.userId).toBe('u-1');
    expect(context.routeType).toBe('stream');
    expect(typeof context.abort).toBe('function');
  });

  it('aborts with a structured reason and exposes it to downstream helpers', () => {
    const context = createAIRequestContext({ userId: 'u-1' });
    context.abort('client_disconnect');

    expect(context.signal.aborted).toBe(true);
    expect(context.getAbortReason()).toBe('client_disconnect');
    expect(() => throwIfAborted(context.signal, () => context.getAbortReason())).toThrow(/client_disconnect/);
  });
});
