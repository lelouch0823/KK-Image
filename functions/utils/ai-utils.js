import { MSG } from '../api/utils/messages.js';

/**
 * 模型冷却池 (In-Memory Map)
 * Key: Model Name
 * Value: Cooldown Expiry Timestamp (ms)
 * 注意：In-Memory 状态在 Cloudflare Workers 中是临时的，但在热实例中有效，
 * 足以应对短时间内的连续请求重试。
 */
const MODEL_COOLDOWNS = new Map();
const COOLDOWN_DURATION = 60 * 1000; // 60秒冷却时间

/**
 * 检查模型是否可用 (未在冷却中)
 */
function isModelAvailable(modelName) {
    if (!MODEL_COOLDOWNS.has(modelName)) return true;
    const expiry = MODEL_COOLDOWNS.get(modelName);
    if (Date.now() > expiry) {
        MODEL_COOLDOWNS.delete(modelName);
        return true;
    }
    return false;
}

/**
 * 将模型标记为限流 (进入冷却)
 */
function markModelRateLimited(modelName) {
    console.warn(`[AI] Marking model ${modelName} as rate-limited for ${COOLDOWN_DURATION / 1000}s`);
    MODEL_COOLDOWNS.set(modelName, Date.now() + COOLDOWN_DURATION);
}

/**
 * 获取下一个可用模型的索引
 */
function getNextAvailableModelIndex(models, currentIndex) {
    for (let i = currentIndex + 1; i < models.length; i++) {
        if (isModelAvailable(models[i])) {
            return i;
        }
    }
    return -1; // 没有更多可用模型
}

/**
 * 解析模型列表环境变量
 * @param {string} modelsEnv - 逗号分隔的模型列表
 * @returns {string[]} 模型名称数组
 */
export function parseModels(modelsEnv) {
    if (!modelsEnv) return [];
    return modelsEnv.split(',').map(m => m.trim()).filter(Boolean);
}

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

    // 解析模型列表
    const models = parseModels(AI_MODELS);
    if (models.length === 0 && AI_MODEL) {
        models.push(AI_MODEL);
    }

    if (!AI_API_KEY || !AI_API_URL || models.length === 0) {
        throw new Error(MSG.AI.CONFIG_MISSING);
    }

    // 智能模型选择
    let activeIndex = modelIndex;
    if (!isModelAvailable(models[activeIndex])) {
        const nextIndex = getNextAvailableModelIndex(models, activeIndex);
        if (nextIndex !== -1) {
            activeIndex = nextIndex;
        }
        // 如果所有都不可用，只能尝试当前的
    }
    const currentModel = models[activeIndex];
    const cleanApiUrl = AI_API_URL.replace(/\/+$/, '');

    // 执行请求
    const response = await requestFn(currentModel, AI_API_KEY, cleanApiUrl);

    // 检查限流状态
    const rateLimit = getRateLimitStatus(response);

    // 额度不足预警切换
    if (rateLimit.modelRemaining < threshold) {
        markModelRateLimited(currentModel);
        const nextIndex = getNextAvailableModelIndex(models, activeIndex);
        if (nextIndex !== -1) {
            console.log(`[AI] Model ${currentModel} low quota (${rateLimit.modelRemaining}), switching...`);
            return executeAIRequest(env, nextIndex, requestFn);
        }
    }

    // 处理 API 错误
    if (!response.ok) {
        // 429 限流
        if (response.status === 429) {
            markModelRateLimited(currentModel);
            const nextIndex = getNextAvailableModelIndex(models, activeIndex);
            if (nextIndex !== -1) {
                console.log(`[AI] Model ${currentModel} 429 rate limited, switching...`);
                return executeAIRequest(env, nextIndex, requestFn);
            }
        }

        // 其他错误抛出
        const errorBody = await response.text();
        throw new Error(`AI API error (${response.status}): ${errorBody}`);
    }

    return {
        response,
        model: currentModel,
        switched: activeIndex > 0, // 只要不是 0 号位，就算 switched
        rateLimit
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
            rateLimit: result.rateLimit
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
        rateLimit: result.rateLimit
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
                try {
                    results.push(JSON.parse(data));
                } catch (_e) {
                    // 忽略无法解析的行
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
