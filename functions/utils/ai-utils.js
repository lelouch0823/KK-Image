/**
 * AI 工具辅助函数 (AI Utilities)
 * =============================
 * 
 * 封装与 OpenAI 兼容 API 的交互逻辑。
 */

/**
 * 调用外部 AI API (非流式)
 */
export async function callAI(messages, tools, env) {
    const { AI_API_KEY, AI_API_URL, AI_MODEL } = env;

    if (!AI_API_KEY || !AI_API_URL || !AI_MODEL) {
        throw new Error('AI configuration missing: AI_API_KEY, AI_API_URL, or AI_MODEL');
    }

    const response = await fetch(`${AI_API_URL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`AI API error (${response.status}): ${errorBody}`);
    }

    return await response.json();
}

/**
 * 调用外部 AI API (流式)
 * @returns {Promise<ReadableStream>} 返回可读流
 */
export async function callAIStream(messages, tools, env) {
    const { AI_API_KEY, AI_API_URL, AI_MODEL } = env;

    if (!AI_API_KEY || !AI_API_URL || !AI_MODEL) {
        throw new Error('AI configuration missing');
    }

    const response = await fetch(`${AI_API_URL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
            stream: true
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`AI API error (${response.status}): ${errorBody}`);
    }

    return response.body;
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
