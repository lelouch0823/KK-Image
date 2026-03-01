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

    // --- 模式 1：检测原有 <tools JSON 标记 ---
    const toolsStartIndex = content.indexOf('<tools');
    if (toolsStartIndex !== -1) {
        const toolsSection = content.slice(toolsStartIndex);
        const jsonMatches = toolsSection.matchAll(/\{"name":\s*"([^"]+)",\s*"arguments":\s*(\{[^}]*\})\}/g);
        let index = 0;
        for (const match of jsonMatches) {
            toolCalls.push({
                id: `textcall_json_${index++}_${Date.now()}`,
                name: match[1],
                arguments: match[2]
            });
        }
        if (toolCalls.length > 0) {
            cleanText = content.slice(0, toolsStartIndex).trim();
            return { cleanText, toolCalls };
        }
    }

    // --- 模式 2：检测 XML 风格标记 (针对某些模型的泄露，如 <arg_key>limit</arg_key><arg_value>50</arg_value>) ---
    // 这种模式下，函数名通常紧随在前面的正文或特定标记之后
    // 查找包含 arg_key/arg_value 结构的文本
    if (content.includes('</arg_key>') || content.includes('</arg_value>')) {
        // 尝试匹配工具名。模型通常先输出函数名，然后跟着一堆参数标签
        // 我们寻找最可能的函数名位置：在一个换行符之后，且后面紧跟着参数标签
        const tools = ['searchVariants', 'getOrderStats', 'getRecentPending', 'getCustomerStats', 'getSpaceStats', 'getSalespersonStats', 'getFileStats', 'searchOrders', 'searchProducts', 'searchCustomers', 'getOrderDetail', 'getProductDetail', 'getVariantDetail', 'getCustomerDetail', 'getGoodsOverviewSummary', 'getGoodsOverviewList'];
        
        for (const toolName of tools) {
            if (content.includes(toolName)) {
                const args = {};
                // 提取所有 key-value 对
                const kvMatches = content.matchAll(/<arg_key>([^<]+)<\/arg_key>\s*<arg_value>([^<]+)<\/arg_value>/g);
                let hasArgs = false;
                for (const match of kvMatches) {
                    args[match[1].trim()] = match[2].trim();
                    hasArgs = true;
                }

                if (hasArgs || content.indexOf(toolName) !== -1) {
                    toolCalls.push({
                        id: `textcall_xml_0_${Date.now()}`,
                        name: toolName,
                        arguments: JSON.stringify(args)
                    });
                    
                    // 清理文本：找到第一个工具名出现的位置，将其及之后的内容全部切掉
                    const firstToolIndex = content.indexOf(toolName);
                    cleanText = content.slice(0, firstToolIndex).trim();
                    return { cleanText, toolCalls };
                }
            }
        }
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
