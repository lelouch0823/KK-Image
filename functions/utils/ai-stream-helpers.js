/**
 * AI Stream Helpers
 * ===================
 * 
 * 流式响应处理的辅助函数，包括：
 * - SSE 事件发送
 * - 文本格式工具调用解析
 * - 工具调用处理
 */

/**
 * 从文本内容中提取工具调用
 * 支持解析模型以纯文本形式输出的工具调用格式
 * 
 * 示例格式：
 * <tools
 * {"name": "getOrderStats", "arguments": {}}
 * {"name": "getCustomerStats", "arguments": {}}
 * 
 * @param {string} content - AI 输出的文本内容
 * @returns {{ cleanText: string, toolCalls: Array<{name: string, arguments: string, id: string}> }}
 */
export function extractToolCallsFromText(content) {
    const toolCalls = [];
    let cleanText = content;

    // 检测 <tools 标记
    const toolsStartIndex = content.indexOf('<tools');
    if (toolsStartIndex === -1) {
        return { cleanText, toolCalls };
    }

    // 提取 <tools 之后的内容
    const toolsSection = content.slice(toolsStartIndex);

    // 尝试匹配所有 JSON 对象 (每行一个)
    const jsonMatches = toolsSection.matchAll(/\{"name":\s*"([^"]+)",\s*"arguments":\s*(\{[^}]*\})\}/g);

    let index = 0;
    for (const match of jsonMatches) {
        const name = match[1];
        const args = match[2];
        toolCalls.push({
            id: `textcall_${index++}_${Date.now()}`,
            name,
            arguments: args
        });
        console.log(`[AI Helper] Extracted text-based tool call: ${name}`);
    }

    // 从内容中移除工具调用部分
    if (toolCalls.length > 0) {
        // 移除 <tools 开始到文本结尾或直到遇到正常内容
        cleanText = content.slice(0, toolsStartIndex).trim();
    }

    return { cleanText, toolCalls };
}

/**
 * 创建 SSE 事件发送器
 * @param {WritableStreamDefaultController} controller - 流控制器
 * @param {TextEncoder} encoder - 文本编码器
 * @returns {Function} sendSSE 函数
 */
export function createSSESender(controller, encoder) {
    return (event, data) => {
        try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
            console.error('[SSE] Failed to send event:', event, e.message);
        }
    };
}

/**
 * 处理工具调用的辅助函数
 * @param {Array} toolCalls - 累积的工具调用信息
 * @param {Function} executeTool - 工具执行函数
 * @param {Function} sendSSE - SSE 发送函数
 * @param {string} toolResultMsg - 工具结果提示消息
 * @param {string|null} fullContent - 助手消息的完整内容（可选）
 * @returns {Array} 要添加到 messages 的新消息
 */
export async function processToolCalls(toolCalls, executeTool, sendSSE, toolResultMsg, fullContent = null) {
    const newMessages = [];

    for (const tc of toolCalls) {
        if (!tc.name) continue;

        // 通知客户端工具执行状态
        sendSSE('tool_call', { name: tc.name, status: 'started' });

        // 执行工具
        const args = tc.arguments ? JSON.parse(tc.arguments) : {};
        const result = await executeTool(tc.name, args);

        sendSSE('tool_result', { name: tc.name, summary: toolResultMsg });

        // 构造消息
        newMessages.push({
            role: 'assistant',
            content: fullContent || null,
            tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }]
        });
        newMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result)
        });
    }

    return newMessages;
}
