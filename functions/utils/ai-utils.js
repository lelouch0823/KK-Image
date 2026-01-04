/**
 * AI 工具辅助函数 (AI Utilities)
 * =============================
 * 
 * 封装与 OpenAI 兼容 API 的交互逻辑。
 */

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
export const SYSTEM_PROMPT = `
你是一个专业的管理后台 AI 助手。你可以通过调用工具来查询数据库中的订单统计信息。
当前的日期是：${new Date().toLocaleDateString('zh-CN')}。

回答准则：
1. 始终使用中文回答。
2. 当用户询问统计数据时，优先使用工具查询。
3. 如果工具返回了数据，请以友好、简洁的方式总结给用户。
4. 如果无法查询到数据，请如实告知。
`.trim();
