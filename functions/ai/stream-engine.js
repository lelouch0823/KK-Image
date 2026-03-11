import { MSG } from '../api/utils/messages.js';
import { AI_TOOLS } from '../api/utils/ai-prompts.js';
import { callAIStream as defaultCallAIStream, parseSSEChunk as defaultParseSSEChunk } from '../utils/ai-utils.js';
import { extractToolCallsFromText as defaultExtractToolCallsFromText, ContentGate as DefaultContentGate } from '../utils/ai-stream-helpers.js';

async function processStreamToEvents(aiStream, {
  emit,
  parseSSEChunk = defaultParseSSEChunk,
  extractToolCallsFromText = defaultExtractToolCallsFromText,
  ContentGate = DefaultContentGate,
  streamOptions = {},
} = {}) {
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let toolCalls = [];
  let buffer = '';
  const gateEnabled = streamOptions.gateEnabled !== false;
  const gate = gateEnabled ? new ContentGate({
    lookahead: 80,
    suspectWindow: streamOptions.strictMode ? 260 : 220,
  }) : null;

  while (true) {
    const { done, value } = await reader.read();
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
  });

  let pendingCalls = initialParsed.toolCalls;
  let currentContent = initialParsed.fullContent;
  let round = 0;
  let executedTools = 0;

  while (pendingCalls.length > 0 && round < maxToolRounds) {
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
      await emit({ type: 'tool_call', data: { name: tc.name, status: 'started' } });

      let args = {};
      try {
        args = parseJsonObject(tc.arguments, {});
      } catch (_parseErr) {
        console.warn(`[AI Stream] Failed to parse tool arguments: ${tc.arguments}`);
      }

      const result = await executeTool(tc.name, args);
      await emit({ type: 'tool_result', data: { name: tc.name, summary: MSG.AI.TOOLS.RESULT_READY } });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      executedTools += 1;
    }

    currentContent = null;
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
import { parseJsonObject } from '../api/utils/json.js';
