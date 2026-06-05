import { MSG } from '../api/utils/messages.js';
import { AI_TOOLS } from '../api/utils/ai-prompts.js';
import { parseJsonObject } from '../api/utils/json.js';
import { callAIStream as defaultCallAIStream, parseSSEChunk as defaultParseSSEChunk } from '../utils/ai-utils.js';
import { extractToolCallsFromText as defaultExtractToolCallsFromText, ContentGate as DefaultContentGate } from '../utils/ai-stream-helpers.js';
import { createStructuredAbortError, throwIfAborted } from './request-context.js';
import { runToolOrchestration } from './tool-orchestrator.js';

function getAbortReason(requestContext) {
  return requestContext?.getAbortReason?.() || requestContext?.signal?.reason || 'aborted';
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

async function handleStreamAbort(error, reader, emit, requestContext) {
  if (!requestContext?.signal?.aborted && error?.name !== 'AbortError') {
    throw error;
  }

  const reason = getAbortReason(requestContext);
  if (typeof reader?.cancel === 'function') {
    await reader.cancel(reason);
  }
  await emit({ type: 'cancellation', data: { reason } });
  throw createStructuredAbortError(reason);
}

async function processStreamToEvents(aiStream, {
  emit,
  parseSSEChunk = defaultParseSSEChunk,
  extractToolCallsFromText = defaultExtractToolCallsFromText,
  ContentGate = DefaultContentGate,
  streamOptions = {},
  requestContext = null,
} = {}) {
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let toolCalls = [];
  let buffer = '';
  const gateEnabled = streamOptions.gateEnabled !== false;
  const gate = gateEnabled ? new ContentGate({
    lookahead: streamOptions.lookahead ?? 80,
    suspectWindow: streamOptions.suspectWindow ?? (streamOptions.strictMode ? 260 : 220),
  }) : null;

  while (true) {
    try {
      throwIfAborted(requestContext?.signal, () => getAbortReason(requestContext));
      const { done, value } = await reader.read();
      throwIfAborted(requestContext?.signal, () => getAbortReason(requestContext));
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const chunks = parseSSEChunk(`${part}\n`);
        for (const chunk of chunks) {
          if (chunk.done) continue;
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullContent += delta.content;
            if (!gate) {
              await emit({ type: 'text_delta', data: { content: delta.content } });
            } else {
              const { safeText } = gate.push(delta.content);
              if (safeText) {
                await emit({ type: 'text_delta', data: { content: safeText } });
              }
            }
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', name: '', arguments: '' };
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          }
        }
      }
    } catch (error) {
      await handleStreamAbort(error, reader, emit, requestContext);
    }
  }

  if (gate) {
    const remaining = gate.flush();
    if (remaining) {
      await emit({ type: 'text_delta', data: { content: remaining } });
    }
  }

  if (toolCalls.length === 0 && fullContent) {
    const extracted = extractToolCallsFromText(fullContent);
    if (extracted.toolCalls.length > 0) {
      toolCalls = extracted.toolCalls;
      fullContent = extracted.cleanText;
    }
  }

  return {
    fullContent,
    toolCalls,
    gateStats: gate?.getStats ? gate.getStats() : null,
  };
}

export async function runAIStreamEngine({
  initialResult,
  initialMessages,
  runtimeEnv,
  tools = AI_TOOLS,
  callAIStream = defaultCallAIStream,
  parseSSEChunk = defaultParseSSEChunk,
  extractToolCallsFromText = defaultExtractToolCallsFromText,
  ContentGate = DefaultContentGate,
  emit = async () => {},
  executeTool,
  maxToolRounds = 3,
  maxToolsPerRound = 8,
  streamOptions = {},
  requestContext = null,
} = {}) {
  const messages = Array.isArray(initialMessages) ? [...initialMessages] : [];
  const initialStreamResult = initialResult || await callAIStream(messages, tools, runtimeEnv);

  if (initialStreamResult?.switched) {
    await emit({ type: 'model_switch', data: { model: initialStreamResult.model, reason: 'rate_limit' } });
  }

  const initialParsed = await processStreamToEvents(initialStreamResult.body, {
    emit,
    parseSSEChunk,
    extractToolCallsFromText,
    ContentGate,
    streamOptions,
    requestContext,
  });

  let pendingCalls = initialParsed.toolCalls;
  let currentContent = initialParsed.fullContent;
  let round = 0;
  let executedTools = 0;

  while (pendingCalls.length > 0 && round < maxToolRounds) {
    throwIfAborted(requestContext?.signal, () => getAbortReason(requestContext));
    round += 1;
    const roundCalls = pendingCalls
      .filter((tc) => tc?.name)
      .slice(0, maxToolsPerRound);

    if (roundCalls.length === 0) break;

    messages.push({
      role: 'assistant',
      content: currentContent || null,
      tool_calls: roundCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const tc of roundCalls) {
      throwIfAborted(requestContext?.signal, () => getAbortReason(requestContext));
      await emit({ type: 'tool_call', data: { name: tc.name, status: 'started' } });
    }

    const orchestrated = await runToolOrchestration({
      toolCalls: roundCalls.map((tc) => {
        let args = {};
        try {
          args = parseJsonObject(tc.arguments, {});
        } catch (_parseErr) {
          console.warn(`[AI Stream] Failed to parse tool arguments: ${tc.arguments}`);
        }
        return {
          id: tc.id,
          name: tc.name,
          arguments: args,
        };
      }),
      executeTool: async (name, args) => executeTool(name, args),
      concurrency: normalizePositiveInt(runtimeEnv?.AI_TOOL_CONCURRENCY, roundCalls.length || 1),
      timeoutMs: normalizePositiveInt(runtimeEnv?.AI_TOOL_TIMEOUT_MS, 0),
      requestContext,
    });

    for (const result of orchestrated.results) {
      if (!result) continue;

      if (result.status === 'success') {
        await emit({
          type: 'tool_result',
          data: { name: result.name, status: 'success', summary: MSG.AI.TOOLS.RESULT_READY },
        });
        messages.push({ role: 'tool', tool_call_id: result.toolCallId, content: JSON.stringify(result.output) });
        executedTools += 1;
        continue;
      }

      if (result.status === 'aborted') {
        // Tool was interrupted by abort - do not emit tool_result
        // The abort will be caught by throwIfAborted on next iteration
        continue;
      }

      if (result.status === 'skipped') {
        // Tool was never started due to prior abort - do not emit tool_result
        continue;
      }

      if (result.status === 'timeout') {
        await emit({ type: 'tool_timeout', data: { name: result.name, status: 'timeout', error: result.error } });
        messages.push({
          role: 'tool',
          tool_call_id: result.toolCallId,
          content: JSON.stringify({ error: true, status: 'timeout', message: result.error }),
        });
        continue;
      }

      if (result.status === 'failure') {
        await emit({ type: 'tool_failure', data: { name: result.name, status: 'failure', error: result.error } });
        messages.push({
          role: 'tool',
          tool_call_id: result.toolCallId,
          content: JSON.stringify({ error: true, status: 'failure', message: result.error }),
        });
      }
    }

    currentContent = null;
    throwIfAborted(requestContext?.signal, () => getAbortReason(requestContext));
    const nextResult = await callAIStream(messages, tools, runtimeEnv);
    if (nextResult?.switched) {
      await emit({ type: 'model_switch', data: { model: nextResult.model, reason: 'rate_limit' } });
    }

    const parsed = await processStreamToEvents(nextResult.body, {
      emit,
      parseSSEChunk,
      extractToolCallsFromText,
      ContentGate,
      streamOptions,
      requestContext,
    });
    pendingCalls = parsed.toolCalls;
    currentContent = parsed.fullContent;
  }

  if (round >= maxToolRounds && pendingCalls.length > 0) {
    await emit({
      type: 'error',
      data: {
        type: 'tool_round_exhausted',
        message: '当前请求过于复杂，建议缩小范围后重试。',
      },
    });
  }

  return {
    initialResult: initialStreamResult,
    initialParsed,
    fullContent: currentContent,
    roundTelemetry: {
      rounds: round,
      executedTools,
      lastToolCalls: pendingCalls.length,
    },
  };
}
