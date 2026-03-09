import { describe, expect, it, vi } from 'vitest';
import { runAIStreamEngine } from '../stream-engine.js';

/* global ReadableStream */

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
        body: createReadable(['data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"searchVariants","arguments":"{\\"search\\":\\"scale\\"}"}}]}}]}\n\n']),
        model: 'model-a',
        switched: false,
      })
      .mockResolvedValueOnce({
        body: createReadable(['data: {"choices":[{"delta":{"content":"已找到 2 个变体。"}}]}\n\n', 'data: [DONE]\n\n']),
        model: 'model-a',
        switched: false,
      });

    const result = await runAIStreamEngine({
      initialMessages: [{ role: 'system', content: 'prompt' }, { role: 'user', content: '查变体' }],
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
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'text_delta',
      data: expect.objectContaining({ content: '已找到 2 个变体。' }),
    }));
    expect(result.roundTelemetry.executedTools).toBe(1);
  });

  it('emits a structured error when tool rounds exceed the configured limit', async () => {
    const emit = vi.fn();
    const callAIStream = vi.fn().mockImplementation(async () => ({
      body: createReadable(['data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"searchVariants","arguments":"{\\"search\\":\\"scale\\"}"}}]}}]}\n\n']),
      model: 'model-a',
      switched: false,
    }));

    await runAIStreamEngine({
      initialMessages: [{ role: 'system', content: 'prompt' }, { role: 'user', content: '查变体' }],
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

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      data: expect.objectContaining({
        type: 'tool_round_exhausted',
      }),
    }));
  });
});
