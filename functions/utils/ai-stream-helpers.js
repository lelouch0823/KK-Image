/**
 * AI Stream Helpers
 * ===================
 * 
 * 流式响应处理的辅助函数，包括：
 * - SSE 事件发送
 * - 图表块解析（:::chart ... :::）
 * - Buffer 管理
 */

/**
 * 从完整内容中解析所有图表块
 * 返回纯文本内容和提取的图表数据数组
 * 
 * @param {string} content - 完整的 AI 响应内容
 * @returns {{ text: string, charts: Array<Object> }}
 */
export function extractChartsFromContent(content) {
    const charts = [];
    let textContent = content;

    // 使用正则匹配所有 :::chart ... ::: 块
    // 支持多行 JSON，非贪婪匹配
    const chartRegex = /:::chart\s*([\s\S]*?)\s*:::/g;
    let match;

    while ((match = chartRegex.exec(content)) !== null) {
        const rawJson = match[1].trim();
        try {
            const chartData = JSON.parse(rawJson);
            charts.push(chartData);
            console.log('[AI Helper] Successfully parsed chart:', chartData.title || chartData.type);
        } catch (e) {
            console.error('[AI Helper] Failed to parse chart JSON:', e.message);
            console.log('[AI Helper] Raw JSON (first 200 chars):', rawJson.slice(0, 200));
            // 解析失败时保留原文
        }
    }

    // 从文本中移除图表块
    textContent = content.replace(chartRegex, '').trim();

    // 清理多余的空行
    textContent = textContent.replace(/\n{3,}/g, '\n\n');

    return { text: textContent, charts };
}

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
 * 简化的流式文本处理器
 * 不进行实时图表解析，只累积内容
 * 图表解析留到最后统一处理
 */
export class StreamContentAccumulator {
    constructor() {
        this.buffer = '';
        this.fullContent = '';
    }

    /**
     * 添加内容到累积器
     * @param {string} content - 新的内容片段
     */
    append(content) {
        this.fullContent += content;
        this.buffer += content;
    }

    /**
     * 获取可以安全发送的文本（排除可能的图表开头）
     * @returns {string} 安全文本
     */
    getSafeText() {
        // 检查是否有未完成的图表块
        const chartStartIndex = this.buffer.indexOf(':::chart');

        if (chartStartIndex === -1) {
            // 没有图表开始标记，但检查是否以 :::c / :::ch 等开头
            const partialMarkers = [':', '::', ':::', ':::c', ':::ch', ':::cha', ':::char', ':::chart'];
            for (let i = partialMarkers.length - 1; i >= 0; i--) {
                const marker = partialMarkers[i];
                if (this.buffer.endsWith(marker)) {
                    // 保留可能的标记，返回之前的内容
                    const safeText = this.buffer.slice(0, -marker.length);
                    this.buffer = marker;
                    return safeText;
                }
            }
            // 没有任何标记，全部安全
            const text = this.buffer;
            this.buffer = '';
            return text;
        }

        // 有图表开始标记，返回之前的文本，保留图表块
        const safeText = this.buffer.slice(0, chartStartIndex);
        this.buffer = this.buffer.slice(chartStartIndex);
        return safeText;
    }

    /**
     * 获取完整累积内容
     * @returns {string}
     */
    getFullContent() {
        return this.fullContent;
    }

    /**
     * 获取剩余 buffer（用于最终 flush）
     * @returns {string}
     */
    getRemainingBuffer() {
        return this.buffer;
    }

    /**
     * 重置累积器
     */
    reset() {
        this.buffer = '';
        this.fullContent = '';
    }
}

/**
 * 处理工具调用的辅助函数
 * @param {Array} toolCalls - 累积的工具调用信息
 * @param {Function} executeTool - 工具执行函数
 * @param {Function} sendSSE - SSE 发送函数
 * @param {string} toolResultMsg - 工具结果提示消息
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
