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
 * 调用外部 AI API (非流式) - 支持模型切换
 * @param {Array} messages - 消息数组
 * @param {Array} tools - 工具定义数组
 * @param {Object} env - 环境变量
 * @param {number} modelIndex - 当前尝试的模型索引
 * @returns {Promise<{ response: Object, model: string, switched: boolean }>}
 */
export async function callAI(messages, tools, env, modelIndex = 0) {
    const { AI_API_KEY, AI_API_URL, AI_MODELS, AI_MODEL, AI_MODEL_SWITCH_THRESHOLD } = env;
    const threshold = parseInt(AI_MODEL_SWITCH_THRESHOLD || '5');

    // 兼容旧配置：如果没有 AI_MODELS，使用单个 AI_MODEL
    const models = parseModels(AI_MODELS);
    if (models.length === 0 && AI_MODEL) {
        models.push(AI_MODEL);
    }

    if (!AI_API_KEY || !AI_API_URL || models.length === 0) {
        throw new Error('AI configuration missing: AI_API_KEY, AI_API_URL, or AI_MODELS');
    }

    // 确保从当前索引开始找到第一个可用的模型
    let activeIndex = modelIndex;
    if (!isModelAvailable(models[activeIndex])) {
        const nextIndex = getNextAvailableModelIndex(models, activeIndex);
        if (nextIndex !== -1) {
            activeIndex = nextIndex;
        } else {
            // 如果所有后续模型都挂了，但当前索引没挂（不可能，因为 checked），
            // 或者所有都挂了，只能硬着头皮试当前这个（或者抛错）
            // 这里选择硬着头皮试，或者直接抛出 "所有模型繁忙"
            // 简单起见，如果找不到更优的，就试当前的 (哪怕在 CD 中，作为最后挣扎)
        }
    }
    const currentModel = models[activeIndex];

    const response = await fetch(`${AI_API_URL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: currentModel,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined
        })
    });

    // 检查限流状态
    const rateLimit = getRateLimitStatus(response);

    // 如果当前模型额度不足
    if (rateLimit.modelRemaining < threshold) {
        markModelRateLimited(currentModel);

        const nextIndex = getNextAvailableModelIndex(models, activeIndex);
        if (nextIndex !== -1) {
            console.log(`[AI] Model ${currentModel} rate limited (${rateLimit.modelRemaining} remaining), switching to next model...`);
            return callAI(messages, tools, env, nextIndex);
        }
    }

    if (!response.ok) {
        // 如果是 429 限流错误
        if (response.status === 429) {
            markModelRateLimited(currentModel);

            const nextIndex = getNextAvailableModelIndex(models, activeIndex);
            if (nextIndex !== -1) {
                console.log(`[AI] Model ${currentModel} returned 429, switching to next model...`);
                return callAI(messages, tools, env, nextIndex);
            }
        }
        const errorBody = await response.text();
        throw new Error(`AI API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return {
        ...data,
        _meta: {
            model: currentModel,
            switched: activeIndex > 0, // 只要不是初始意图的 0 号位，都算 switched
            rateLimit
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
    const { AI_API_KEY, AI_API_URL, AI_MODELS, AI_MODEL, AI_MODEL_SWITCH_THRESHOLD } = env;
    const threshold = parseInt(AI_MODEL_SWITCH_THRESHOLD || '5');

    // 兼容旧配置
    const models = parseModels(AI_MODELS);
    if (models.length === 0 && AI_MODEL) {
        models.push(AI_MODEL);
    }

    if (!AI_API_KEY || !AI_API_URL || models.length === 0) {
        throw new Error('AI configuration missing');
    }

    // 确保从当前索引开始找到第一个可用的模型
    let activeIndex = modelIndex;
    // 如果当前指定的模型在冷却中，寻找下一个
    if (!isModelAvailable(models[activeIndex])) {
        // console.log(`[AI] Model ${models[activeIndex]} is in cooldown, skipping...`);
        const nextIndex = getNextAvailableModelIndex(models, activeIndex);
        if (nextIndex !== -1) {
            activeIndex = nextIndex;
        }
    }
    const currentModel = models[activeIndex];

    const response = await fetch(`${AI_API_URL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: currentModel,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
            stream: true
        })
    });

    // 检查限流状态
    const rateLimit = getRateLimitStatus(response);

    // 如果当前模型额度不足
    if (rateLimit.modelRemaining < threshold) {
        markModelRateLimited(currentModel);

        const nextIndex = getNextAvailableModelIndex(models, activeIndex);
        if (nextIndex !== -1) {
            console.log(`[AI] Model ${currentModel} rate limited (${rateLimit.modelRemaining} remaining), switching to next model...`);
            return callAIStream(messages, tools, env, nextIndex);
        }
    }

    if (!response.ok) {
        // 如果是 429 限流错误
        if (response.status === 429) {
            markModelRateLimited(currentModel);

            const nextIndex = getNextAvailableModelIndex(models, activeIndex);
            if (nextIndex !== -1) {
                console.log(`[AI] Model ${currentModel} returned 429, switching to next model...`);
                return callAIStream(messages, tools, env, nextIndex);
            }
        }
        const errorBody = await response.text();
        throw new Error(`AI API error (${response.status}): ${errorBody}`);
    }

    return {
        body: response.body,
        model: currentModel,
        switched: activeIndex > 0,
        rateLimit
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
 * 格式化系统提示词
 */
export { SYSTEM_PROMPT } from '../api/utils/ai-prompts.js';
