import { describe, expect, it, vi } from 'vitest';
import { createAIRequestContext } from '../request-context.js';
import { runAIStreamEngine } from '../stream-engine.js';

function createReadable(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe('runAIStreamEngine', () => {
  it('emits text deltas and tool lifecycle events across follow-up rounds', async () => {
    const emit = vi.fn();
    const callAIStream = vi
      .fn()
      .mockResolvedValueOnce({
        body: createReadable([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"searchVariants","arguments":"{\\"search\\":\\"scale\\"}"}}]}}]}\n\n',
        ]),
        model: 'model-a',
        switched: false,
      })
      .mockResolvedValueOnce({
        body: createReadable([
          'data: {"choices":[{"delta":{"content":"已找到 2 个变体。"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        model: 'model-a',
        switched: false,
      });

    const result = await runAIStreamEngine({
      initialMessages: [
        { role: 'system', content: 'prompt' },
        { role: 'user', content: '查变体' },
      ],
      runtimeEnv: {},
      tools: [{ type: 'function', function: { name: 'searchVariants' } }],
      callAIStream,
      parseSSEChunk: (raw) => {
        const text = String(raw || '');
        return text
          .split('\n')
          .filter(Boolean)
          .map((line) => line.replace(/^data:\s*/, ''))
          .filter((line) => line !== '[DONE]')
          .map((line) => JSON.parse(line));
      },
      emit,
      executeTool: vi.fn().mockResolvedValue({ items: [{ id: 'v-1' }, { id: 'v-2' }] }),
      maxToolRounds: 2,
      maxToolsPerRound: 4,
    });

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_call' }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_result' }));
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text_delta',
        data: expect.objectContaining({ content: '已找到 2 个变体。' }),
      })
    );
    expect(result.roundTelemetry.executedTools).toBe(1);
  });

  it('emits a structured error when tool rounds exceed the configured limit', async () => {
    const emit = vi.fn();
    const callAIStream = vi.fn().mockImplementation(async () => ({
      body: createReadable([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"searchVariants","arguments":"{\\"search\\":\\"scale\\"}"}}]}}]}\n\n',
      ]),
      model: 'model-a',
      switched: false,
    }));

    await runAIStreamEngine({
      initialMessages: [
        { role: 'system', content: 'prompt' },
        { role: 'user', content: '查变体' },
      ],
      runtimeEnv: {},
      tools: [{ type: 'function', function: { name: 'searchVariants' } }],
      callAIStream,
      parseSSEChunk: (raw) => {
        const text = String(raw || '');
        return text
          .split('\n')
          .filter(Boolean)
          .map((line) => line.replace(/^data:\s*/, ''))
          .filter((line) => line !== '[DONE]')
          .map((line) => JSON.parse(line));
      },
      emit,
      executeTool: vi.fn().mockResolvedValue({ ok: true }),
      maxToolRounds: 1,
      maxToolsPerRound: 4,
    });

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          type: 'tool_round_exhausted',
        }),
      })
    );
  });

  it('stops reading and emits cancellation telemetry when request signal aborts mid-stream', async () => {
    const requestContext = createAIRequestContext({ userId: 'u-1', routeType: 'stream' });
    const emit = vi.fn();
    const readerCancel = vi.fn().mockResolvedValue(undefined);
    const stream = {
      getReader() {
        return {
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'),
            })
            .mockImplementation(async () => {
              requestContext.abort('client_disconnect');
              throw Object.assign(new Error('aborted'), { name: 'AbortError' });
            }),
          cancel: readerCancel,
        };
      },
    };

    await expect(
      runAIStreamEngine({
        initialResult: { body: stream, model: 'model-a', switched: false },
        initialMessages: [],
        runtimeEnv: {},
        emit,
        executeTool: vi.fn(),
        requestContext,
      })
    ).rejects.toThrow(/client_disconnect|aborted/);

    expect(readerCancel).toHaveBeenCalledWith('client_disconnect');
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cancellation',
        data: expect.objectContaining({ reason: 'client_disconnect' }),
      })
    );
  });

  it('does not start queued tool work after the request has been aborted', async () => {
    const requestContext = createAIRequestContext({ userId: 'u-1', routeType: 'stream' });
    requestContext.abort('client_disconnect');
    const executeTool = vi.fn();

    await expect(
      runAIStreamEngine({
        initialResult: {
          body: createReadable([
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"searchVariants","arguments":"{}"}}]}}]}\n\n',
          ]),
          model: 'model-a',
          switched: false,
        },
        initialMessages: [],
        runtimeEnv: {},
        emit: vi.fn(),
        executeTool,
        requestContext,
      })
    ).rejects.toThrow(/client_disconnect/);

    expect(executeTool).not.toHaveBeenCalled();
  });

  it('executes tool calls through the orchestrator and emits structured tool statuses', async () => {
    const emit = vi.fn();
    const callAIStream = vi
      .fn()
      .mockResolvedValueOnce({
        body: createReadable([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"toolA","arguments":"{}"}},{"index":1,"id":"tc_2","function":{"name":"toolB","arguments":"{}"}}]}}]}\n\n',
        ]),
        model: 'model-a',
        switched: false,
      })
      .mockResolvedValueOnce({
        body: createReadable([
          'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        model: 'model-a',
        switched: false,
      });

    const result = await runAIStreamEngine({
      initialMessages: [],
      runtimeEnv: { AI_TOOL_CONCURRENCY: 2, AI_TOOL_TIMEOUT_MS: 100 },
      callAIStream,
      emit,
      executeTool: vi.fn(async (name) => ({ name })),
    });

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool_result',
        data: expect.objectContaining({ name: 'toolA', status: 'success' }),
      })
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool_result',
        data: expect.objectContaining({ name: 'toolB', status: 'success' }),
      })
    );
    expect(result.roundTelemetry.executedTools).toBe(2);
  });

  it('does not emit tool_result for aborted tool execution', async () => {
    const requestContext = createAIRequestContext({});
    const emit = vi.fn();
    const callAIStream = vi.fn().mockResolvedValue({
      body: createReadable([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"toolA","arguments":"{}"}}]}}]}\n\n',
      ]),
      model: 'model-a',
      switched: false,
    });

    const executeTool = vi.fn(async () => {
      requestContext.abort('client_disconnect');
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });

    await expect(
      runAIStreamEngine({
        initialMessages: [],
        runtimeEnv: {},
        callAIStream,
        emit,
        executeTool,
        requestContext,
      })
    ).rejects.toThrow(/client_disconnect|aborted/);

    // Should not emit tool_result for aborted tool
    expect(emit).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool_result',
      })
    );
  });

  it('does not request the next stream round after abort', async () => {
    const requestContext = createAIRequestContext({});
    const emit = vi.fn();
    const callAIStream = vi.fn().mockResolvedValue({
      body: createReadable([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"toolA","arguments":"{}"}}]}}]}\n\n',
      ]),
      model: 'model-a',
      switched: false,
    });

    const executeTool = vi.fn(async () => {
      requestContext.abort('client_disconnect');
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });

    await expect(
      runAIStreamEngine({
        initialMessages: [],
        runtimeEnv: {},
        callAIStream,
        emit,
        executeTool,
        requestContext,
        maxToolRounds: 3,
      })
    ).rejects.toThrow(/client_disconnect|aborted/);

    // Should only call callAIStream once (initial), not for follow-up
    expect(callAIStream).toHaveBeenCalledTimes(1);
  });
});
