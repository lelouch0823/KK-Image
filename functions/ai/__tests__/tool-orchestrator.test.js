import { describe, expect, it, vi } from 'vitest';
import { runToolOrchestration } from '../tool-orchestrator.js';
import { createAIRequestContext } from '../request-context.js';

describe('tool-orchestrator', () => {
  it('runs independent tool calls in parallel under the configured concurrency limit', async () => {
    const order = [];
    const executeTool = vi.fn(async (name) => {
      order.push(`start:${name}`);
      await Promise.resolve();
      order.push(`end:${name}`);
      return { ok: true, name };
    });

    const result = await runToolOrchestration({
      toolCalls: [
        { id: '1', name: 'toolA', arguments: '{}' },
        { id: '2', name: 'toolB', arguments: '{}' },
      ],
      executeTool,
      concurrency: 2,
      timeoutMs: 500,
    });

    expect(result.results).toHaveLength(2);
    expect(order.slice(0, 2)).toEqual(['start:toolA', 'start:toolB']);
  });

  it('returns a timeout envelope instead of hanging the whole round', async () => {
    const executeTool = vi.fn(async () => new Promise(() => {}));

    const result = await runToolOrchestration({
      toolCalls: [{ id: '1', name: 'slowTool', arguments: '{}' }],
      executeTool,
      concurrency: 1,
      timeoutMs: 10,
    });

    expect(result.results[0]).toEqual(expect.objectContaining({
      status: 'timeout',
      toolCallId: '1',
      name: 'slowTool',
    }));
  });

  it('stops scheduling additional tool calls when the request is aborted', async () => {
    const requestContext = createAIRequestContext({ userId: 'u-1', routeType: 'stream' });
    const executeTool = vi.fn(async (name) => {
      if (name === 'toolA') requestContext.abort('client_disconnect');
      return { ok: true };
    });

    const result = await runToolOrchestration({
      toolCalls: [
        { id: '1', name: 'toolA', arguments: '{}' },
        { id: '2', name: 'toolB', arguments: '{}' },
      ],
      executeTool,
      concurrency: 1,
      timeoutMs: 500,
      requestContext,
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.results[1]).toEqual(expect.objectContaining({
      status: 'skipped',
      toolCallId: '2',
      name: 'toolB',
    }));
  });
});
