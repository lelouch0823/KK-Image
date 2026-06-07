import { safeJsonParse } from '../api/utils/json.js';
import {
  getModelHealthSnapshot,
  parseModels,
  resetModelHealthStatsForTests,
} from '../ai/model-policy.js';
import { executeAIRequest } from '../ai/request-executor.js';
import { createStructuredAbortError } from '../ai/request-context.js';

export { getModelHealthSnapshot, parseModels, resetModelHealthStatsForTests };

/** 默认限流上限值（当响应头缺失时使用） */
const DEFAULT_RATE_LIMIT = 9999;

/**
 * 从响应头中提取限流状态
 * @param {Response} response - fetch 响应对象
 * @returns {{ remaining: number, limit: number, modelRemaining: number, modelLimit: number }}
 */
export function getRateLimitStatus(response) {
  return {
    remaining: parseInt(
      response.headers.get('modelscope-ratelimit-requests-remaining') || String(DEFAULT_RATE_LIMIT),
      10
    ),
    limit: parseInt(
      response.headers.get('modelscope-ratelimit-requests-limit') || String(DEFAULT_RATE_LIMIT),
      10
    ),
    modelRemaining: parseInt(
      response.headers.get('modelscope-ratelimit-model-requests-remaining') ||
        String(DEFAULT_RATE_LIMIT),
      10
    ),
    modelLimit: parseInt(
      response.headers.get('modelscope-ratelimit-model-requests-limit') ||
        String(DEFAULT_RATE_LIMIT),
      10
    ),
  };
}

/**
 * Internal wrapper that calls the new request-executor with signal from runtime env
 * @param {Object} env - Environment including optional AI_REQUEST_SIGNAL
 * @param {number} modelIndex - Current model index
 * @param {Function} requestFn - Request function
 * @returns {Promise<{ response: Response, model: string, switched: boolean, rateLimit: Object, retryCount: number }>}
 */
async function runExecutor(env, modelIndex, requestFn) {
  const signal = env?.AI_REQUEST_SIGNAL;
  return executeAIRequest({
    env,
    modelIndex,
    signal,
    requestFn,
  });
}

/**
 * 调用外部 AI API (非流式) - 支持模型切换
 * @param {Array} messages - 消息数组
 * @param {Array} tools - 工具定义数组
 * @param {Object} env - 环境变量
 * @param {number} modelIndex - 当前尝试的模型索引
 * @returns {Promise<{ response: Object, model: string, switched: boolean }>}
 */
export async function callAI(messages, tools, env, modelIndex = 0) {
  const result = await runExecutor(env, modelIndex, async ({ model, apiKey, apiUrl, signal }) => {
    return fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        // MiniMax M2.1 思考模型支持：分离推理内容
        reasoning_split: true,
      }),
      signal,
    });
  });

  const data = await result.response.json();

  // 过滤思考模型的推理内容（reasoning_details），只保留最终输出
  if (data.choices?.[0]?.message) {
    delete data.choices[0].message.reasoning_details;
  }

  return {
    ...data,
    _meta: {
      model: result.model,
      switched: result.switched,
      rateLimit: result.rateLimit,
      retryCount: result.retryCount || 0,
    },
  };
}

/**
 * 调用外部 AI API (流式) - 支持模型切换
 * @param {Array} messages - 消息数组
 * @param {Array} tools - 工具定义数组
 * @param {Object} env - 环境变量
 * @param {number} modelIndex - 当前尝试的模型索引
 * @returns {Promise<{ body: ReadableStream, model: string, switched: boolean }>}
 */
export async function callAIStream(messages, tools, env, modelIndex = 0) {
  const result = await runExecutor(env, modelIndex, async ({ model, apiKey, apiUrl, signal }) => {
    return fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        stream: true,
        // MiniMax M2.1 思考模型支持：分离推理内容
        reasoning_split: true,
      }),
      signal,
    });
  });

  return {
    body: result.response.body,
    model: result.model,
    switched: result.switched,
    rateLimit: result.rateLimit,
    retryCount: result.retryCount || 0,
  };
}

/**
 * 解析 SSE 流中的数据行
 * @param {string} chunk - 原始文本块
 * @returns {Array} 解析后的数据对象数组
 */
export function parseSSEChunk(chunk) {
  const lines = chunk.split('\n');
  const results = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        results.push({ done: true });
      } else {
        const parsed = safeJsonParse(data);
        if (parsed) {
          results.push(parsed);
        }
      }
    }
  }

  return results;
}

/**
 * 智能 AI 调用 - 自动处理流式/非流式切换
 *
 * 当模型返回 400 错误（不支持某种模式）时，自动切换到另一模式重试。
 *
 * @param {Object} options
 * @param {Array} options.messages - 消息数组
 * @param {Array} options.tools - 工具定义（可选）
 * @param {Object} options.env - 环境变量
 * @param {boolean} options.preferStream - 优先使用流式模式（默认 true）
 * @param {boolean} options.accumulate - 累积全部内容返回（用于报告生成）
 * @returns {Promise<{ content: string, toolCalls?: Array, model?: string }>}
 */
export async function callAIAuto({
  messages,
  tools = [],
  env,
  preferStream = true,
  _accumulate = true,
}) {
  const signal = env?.AI_REQUEST_SIGNAL;

  const tryStream = async () => {
    const result = await callAIStream(messages, tools, env);
    const reader = result.body.getReader();
    const decoder = new TextDecoder();

    let fullContent = '';
    let buffer = '';
    const toolCalls = [];

    while (true) {
      // Check abort during streaming
      if (signal?.aborted) {
        reader.cancel();
        throw createStructuredAbortError(signal.reason || 'aborted');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lastNewlineIndex = buffer.lastIndexOf('\n');

      if (lastNewlineIndex !== -1) {
        const toParse = buffer.slice(0, lastNewlineIndex + 1);
        buffer = buffer.slice(lastNewlineIndex + 1);

        const chunks = parseSSEChunk(toParse);
        for (const chunk of chunks) {
          if (chunk.done) continue;
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: '', name: '', arguments: '' };
                }
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
              }
            }
          }
        }
      }
    }

    // 处理剩余 buffer
    if (buffer.trim()) {
      const chunks = parseSSEChunk(buffer);
      for (const chunk of chunks) {
        if (chunk.done) continue;
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
        }
      }
    }

    return { content: fullContent, toolCalls: toolCalls.filter(Boolean), model: result.model };
  };

  const tryNonStream = async () => {
    const result = await callAI(messages, tools, env);
    const choice = result.choices[0];
    return {
      content: choice?.message?.content || '',
      toolCalls: choice?.message?.tool_calls || [],
      model: result._meta?.model,
    };
  };

  // 智能切换逻辑
  const primaryFn = preferStream ? tryStream : tryNonStream;
  const fallbackFn = preferStream ? tryNonStream : tryStream;

  try {
    return await primaryFn();
  } catch (err) {
    // Do not fallback on abort errors
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('aborted')) {
      throw err;
    }

    // 如果是 400 错误（不支持该模式），切换到另一模式
    if (err.message?.includes('400') || err.message?.includes('invalid_parameter')) {
      // Check abort before fallback
      if (signal?.aborted) {
        throw createStructuredAbortError(signal.reason || 'aborted');
      }
      console.warn('[AI Auto] Primary mode failed, switching to fallback mode...');
      try {
        return await fallbackFn();
      } catch (fallbackErr) {
        console.error('[AI Auto] Fallback mode also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
    throw err;
  }
}

/**
 * 格式化系统提示词
 */
export { SYSTEM_PROMPT } from '../api/utils/ai-prompts.js';
