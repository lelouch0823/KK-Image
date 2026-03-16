import { MSG } from '../api/utils/messages.js';
import { safeJsonParse } from '../api/utils/json.js';
import {
    getModelHealthSnapshot,
    getNextAvailableModelIndex,
    isModelAvailable,
    markModelRateLimited,
    parseHealthWindow,
    parseModels,
    recordModelHealth,
    resetModelHealthStatsForTests,
    resolveModelOrder,
} from '../ai/model-policy.js';
import { executeWithRetry } from '../ai/retry-manager.js';

export { getModelHealthSnapshot, parseModels, resetModelHealthStatsForTests };

/**
 * 从响应头中提取限流状态
 * @param {Response} response - fetch 响应对象
 * @returns {{ remaining: number, limit: number, modelRemaining: number, modelLimit: number }}
 */
export function getRateLimitStatus(response) {
    return {
        remaining: parseInt(response.headers.get('modelscope-ratelimit-requests-remaining') || '9999'),
        limit: parseInt(response.headers.get('modelscope-ratelimit-requests-limit') || '9999'),
        modelRemaining: parseInt(response.headers.get('modelscope-ratelimit-model-requests-remaining') || '9999'),
        modelLimit: parseInt(response.headers.get('modelscope-ratelimit-model-requests-limit') || '9999'),
    };
}

/**
 * 通用 AI 请求执行器 - 处理模型选择、限流和重试逻辑
 * @param {Object} env - 环境变量
 * @param {number} modelIndex - 当前尝试的模型索引
 * @param {Function} requestFn - 请求执行函数 (model, apiKey, apiUrl) => Promise<Response>
 * @returns {Promise<{ response: Response, model: string, switched: boolean, rateLimit: Object }>}
 */
async function executeAIRequest(env, modelIndex, requestFn) {
    const { AI_API_KEY, AI_API_URL, AI_MODELS, AI_MODEL, AI_MODEL_SWITCH_THRESHOLD } = env;
    const threshold = parseInt(AI_MODEL_SWITCH_THRESHOLD || '5');
    const healthWindow = parseHealthWindow(env?.AI_MODEL_HEALTH_WINDOW);
    const retryAttempts = parseInt(env?.AI_RETRY_ATTEMPTS || '0', 10);
    const retryBaseDelayMs = parseInt(env?.AI_RETRY_BASE_DELAY_MS || '0', 10);
    const retryJitterMs = parseInt(env?.AI_RETRY_JITTER_MS || '0', 10);

    // 解析模型列表
    const models = parseModels(AI_MODELS);
    if (models.length === 0 && AI_MODEL) {
        models.push(AI_MODEL);
    }
    const orderedModels = resolveModelOrder(models, env);

    if (!AI_API_KEY || !AI_API_URL || orderedModels.length === 0) {
        throw new Error(MSG.AI.CONFIG_MISSING);
    }

    // 智能模型选择
    let activeIndex = modelIndex;
    if (!isModelAvailable(orderedModels[activeIndex])) {
        const nextIndex = getNextAvailableModelIndex(orderedModels, activeIndex);
        if (nextIndex !== -1) {
            activeIndex = nextIndex;
        }
        // 如果所有都不可用，只能尝试当前的
    }
    const currentModel = orderedModels[activeIndex];
    const cleanApiUrl = AI_API_URL.replace(/\/+$/, '');
    let retryCount = 0;

    // 执行请求
    const requestStartedAt = Date.now();
    let response;
    try {
        response = await executeWithRetry(
            async () => {
                const currentResponse = await requestFn(currentModel, AI_API_KEY, cleanApiUrl);

                if (!currentResponse.ok) {
                    if (currentResponse.status === 429) {
                        return currentResponse;
                    }

                    const errorBody = await currentResponse.text();
                    throw new Error(`AI API error (${currentResponse.status}) [model:${currentModel}]: ${errorBody}`);
                }

                return currentResponse;
            },
            {
                retries: retryAttempts,
                baseDelayMs: retryBaseDelayMs,
                jitterMs: retryJitterMs,
                onRetry: () => {
                    retryCount += 1;
                },
            }
        );
    } catch (err) {
        const latency = Date.now() - requestStartedAt;
        recordModelHealth(currentModel, { ok: false, latencyMs: latency }, healthWindow);
        throw err;
    }
    const latency = Date.now() - requestStartedAt;
    recordModelHealth(currentModel, { ok: response.ok, latencyMs: latency }, healthWindow);

    // 检查限流状态
    const rateLimit = getRateLimitStatus(response);

    // 额度不足预警切换
    if (rateLimit.modelRemaining < threshold) {
        markModelRateLimited(currentModel);
        const nextIndex = getNextAvailableModelIndex(orderedModels, activeIndex);
        if (nextIndex !== -1) {
            console.log(`[AI] Model ${currentModel} low quota (${rateLimit.modelRemaining}), switching...`);
            const switchedResult = await executeAIRequest(env, nextIndex, requestFn);
            return {
                ...switchedResult,
                retryCount: retryCount + (switchedResult.retryCount || 0),
            };
        }
    }

    if (!response.ok) {
        if (response.status === 429) {
            markModelRateLimited(currentModel);
            const nextIndex = getNextAvailableModelIndex(orderedModels, activeIndex);
            if (nextIndex !== -1) {
                console.log(`[AI] Model ${currentModel} 429 rate limited, switching...`);
                const switchedResult = await executeAIRequest(env, nextIndex, requestFn);
                return {
                    ...switchedResult,
                    retryCount: retryCount + (switchedResult.retryCount || 0),
                };
            }
        }

        const errorBody = await response.text();
        throw new Error(`AI API error (${response.status}) [model:${currentModel}]: ${errorBody}`);
    }

    return {
        response,
        model: currentModel,
        switched: activeIndex > 0, // 只要不是 0 号位，就算 switched
        rateLimit,
        retryCount,
    };
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
    const result = await executeAIRequest(env, modelIndex, async (model, apiKey, apiUrl) => {
        return fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
                // MiniMax M2.1 思考模型支持：分离推理内容
                reasoning_split: true
            })
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
        }
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
    const result = await executeAIRequest(env, modelIndex, async (model, apiKey, apiUrl) => {
        return fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
                stream: true,
                // MiniMax M2.1 思考模型支持：分离推理内容
                reasoning_split: true
            })
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
export async function callAIAuto({ messages, tools = [], env, preferStream = true, _accumulate = true }) {
    const tryStream = async () => {
        const result = await callAIStream(messages, tools, env);
        const reader = result.body.getReader();
        const decoder = new TextDecoder();

        let fullContent = '';
        let buffer = '';
        const toolCalls = [];

        while (true) {
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
            model: result._meta?.model
        };
    };

    // 智能切换逻辑
    const primaryFn = preferStream ? tryStream : tryNonStream;
    const fallbackFn = preferStream ? tryNonStream : tryStream;

    try {
        return await primaryFn();
    } catch (err) {
        // 如果是 400 错误（不支持该模式），切换到另一模式
        if (err.message?.includes('400') || err.message?.includes('invalid_parameter')) {
            console.log('[AI Auto] Primary mode failed, switching to fallback mode...');
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
