/**
 * AI 工具辅助函数 (AI Utilities)
 * =============================
 * 
 * 封装与 OpenAI 兼容 API 的交互逻辑。
 */

import { MSG } from '../api/utils/messages.js';
import { DateUtils } from '../api/utils/date.js';

/**
 * 调用外部 AI API
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
 * 格式化系统提示词
 */
export const SYSTEM_PROMPT = MSG.AI.SYSTEM_PROMPT(DateUtils.getChinaDateStr());
