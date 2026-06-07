import { parseJsonObject } from '../api/utils/json.js';

/**
 * AI Stream Helpers
 * ===================
 *
 * 流式响应处理的辅助函数，包括：
 * - SSE 事件发送
 * - 文本格式工具调用解析
 * - 工具调用处理
 */

const DEFAULT_TOOL_NAMES = [
  'searchVariants',
  'getOrderStats',
  'getRecentPendingOrders',
  'getCustomerStats',
  'getSpaceStats',
  'getSalespersonStats',
  'getFileStats',
  'searchOrders',
  'searchProducts',
  'searchCustomers',
  'getOrderDetail',
  'getProductDetail',
  'getVariantDetail',
  'getCustomerDetail',
  'getGoodsOverviewSummary',
  'getGoodsOverviewList',
];

const DEFAULT_DANGER_TAGS = [
  'tools',
  'call',
  'arg_key',
  'arg_value',
  'function_name',
  'parameters',
  'tool_code',
  'thought',
  'think',
  'reasoning',
];

function escapeRegExp(source) {
  return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasDangerTag(text, tags) {
  const normalized = String(text || '').toLowerCase();
  return tags.some((tag) => normalized.includes(`<${tag}`) || normalized.includes(`</${tag}`));
}

function detectStructuredToolPattern(text) {
  return (
    /"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*[{[]/i.test(text) ||
    /<tools\b/i.test(text) ||
    /<arg_key>/i.test(text) ||
    /<arg_value>/i.test(text)
  );
}

function findWeakToolNameIndex(text, toolNames) {
  for (const name of toolNames) {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
    const match = pattern.exec(text);
    if (match) return match.index;
  }
  return -1;
}

function findStrongBoundaryIndex(text, dangerTags) {
  const lower = String(text || '').toLowerCase();
  let minIndex = -1;

  const candidates = [
    lower.indexOf('<tools'),
    lower.search(/"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*[{[]/i),
    lower.indexOf('<arg_key>'),
    lower.indexOf('<arg_value>'),
  ].filter((idx) => idx >= 0);

  for (const tag of dangerTags) {
    const openIdx = lower.indexOf(`<${tag}`);
    const closeIdx = lower.indexOf(`</${tag}`);
    if (openIdx >= 0) candidates.push(openIdx);
    if (closeIdx >= 0) candidates.push(closeIdx);
  }

  for (const idx of candidates) {
    if (idx < 0) continue;
    if (minIndex === -1 || idx < minIndex) minIndex = idx;
  }

  return minIndex;
}

/**
 * 流式内容门控器（状态机）
 * 状态：
 * - pass: 正常透传
 * - suspect: 命中弱信号（先缓冲）
 * - blocking: 命中强信号（阻断工具文本）
 */
export class ContentGate {
  constructor(options = {}) {
    this.state = 'pass';
    this.buffer = '';
    this.blockedContent = '';
    this.lookahead = Number.isFinite(options.lookahead) ? options.lookahead : 80;
    this.suspectWindow = Number.isFinite(options.suspectWindow) ? options.suspectWindow : 220;
    this.recoveryWindow = Number.isFinite(options.recoveryWindow) ? options.recoveryWindow : 300;
    this.toolNames =
      Array.isArray(options.toolNames) && options.toolNames.length > 0
        ? options.toolNames
        : DEFAULT_TOOL_NAMES;
    this.dangerTags =
      Array.isArray(options.dangerTags) && options.dangerTags.length > 0
        ? options.dangerTags
        : DEFAULT_DANGER_TAGS;
    this.stats = {
      inputChars: 0,
      outputChars: 0,
      blockedChars: 0,
      blockedEvents: 0,
      recoveredChars: 0,
      recoveredEvents: 0,
      suspectTransitions: 0,
    };
  }

  push(chunk) {
    const text = String(chunk || '');
    if (!text) return { safeText: '', blocked: this.state === 'blocking' };
    this.stats.inputChars += text.length;

    if (this.state === 'blocking') {
      this.blockedContent += text;
      this.stats.blockedChars += text.length;
      const recovered = this._tryRecover();
      if (recovered) {
        this.stats.outputChars += recovered.length;
      }
      return { safeText: recovered, blocked: true };
    }

    this.buffer += text;

    const strongIndex = this._findStrongIndex(this.buffer);
    if (strongIndex >= 0) {
      const safe = this.buffer.slice(0, strongIndex);
      const blocked = this.buffer.slice(strongIndex);
      this.buffer = '';
      this.state = 'blocking';
      this.blockedContent += blocked;
      this.stats.blockedEvents += 1;
      this.stats.blockedChars += blocked.length;
      this.stats.outputChars += safe.length;
      return { safeText: safe, blocked: true };
    }

    const weakHit = findWeakToolNameIndex(this.buffer, this.toolNames) >= 0;
    if (weakHit && this.state === 'pass') {
      this.state = 'suspect';
      this.stats.suspectTransitions += 1;
    }

    if (this.state === 'suspect' && this.buffer.length < this.suspectWindow) {
      return { safeText: '', blocked: false };
    }

    if (this.buffer.length > this.lookahead) {
      const safe = this.buffer.slice(0, -this.lookahead);
      this.buffer = this.buffer.slice(-this.lookahead);
      if (this.state === 'suspect') {
        this.state = 'pass';
      }
      this.stats.outputChars += safe.length;
      return { safeText: safe, blocked: false };
    }

    return { safeText: '', blocked: false };
  }

  flush() {
    if (this.state === 'blocking') {
      this.blockedContent += this.buffer;
      this.stats.blockedChars += this.buffer.length;
      this.buffer = '';
      return '';
    }

    const strongIndex = this._findStrongIndex(this.buffer);
    if (strongIndex >= 0) {
      const safe = this.buffer.slice(0, strongIndex);
      const blocked = this.buffer.slice(strongIndex);
      this.blockedContent += blocked;
      this.stats.blockedEvents += 1;
      this.stats.blockedChars += blocked.length;
      this.stats.outputChars += safe.length;
      this.buffer = '';
      return safe;
    }

    const remaining = this.buffer;
    this.buffer = '';
    this.state = 'pass';
    this.stats.outputChars += remaining.length;
    return remaining;
  }

  getStats() {
    return {
      ...this.stats,
      state: this.state,
      blockedContentChars: this.blockedContent.length,
    };
  }

  _findStrongIndex(text) {
    if (!text) return -1;
    if (!hasDangerTag(text, this.dangerTags) && !detectStructuredToolPattern(text)) return -1;
    return findStrongBoundaryIndex(text, this.dangerTags);
  }

  _tryRecover() {
    const tail = this.blockedContent.slice(-this.recoveryWindow);
    const splitMatch = /(?:\n{2,}|[。！？!?]\s+)/.exec(tail);
    if (!splitMatch) return '';

    const splitAbsolute =
      this.blockedContent.length - tail.length + splitMatch.index + splitMatch[0].length;
    const candidate = this.blockedContent.slice(splitAbsolute);
    if (!candidate) return '';

    if (
      this._findStrongIndex(candidate) >= 0 ||
      findWeakToolNameIndex(candidate, this.toolNames) >= 0
    ) {
      return '';
    }

    this.blockedContent = this.blockedContent.slice(0, splitAbsolute);
    this.state = 'pass';
    this.stats.recoveredEvents += 1;
    this.stats.recoveredChars += candidate.length;
    return candidate;
  }
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

  // --- 模式 1：检测原有 <tools JSON 标记 ---
  const toolsStartIndex = content.indexOf('<tools');
  if (toolsStartIndex !== -1) {
    const toolsSection = content.slice(toolsStartIndex);
    const jsonMatches = toolsSection.matchAll(
      /\{"name":\s*"([^"]+)",\s*"arguments":\s*(\{[^}]*\})\}/g
    );
    let index = 0;
    for (const match of jsonMatches) {
      toolCalls.push({
        id: `textcall_json_${index++}_${Date.now()}`,
        name: match[1],
        arguments: match[2],
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
    const tools = DEFAULT_TOOL_NAMES;

    for (const toolName of tools) {
      if (content.includes(toolName)) {
        const args = {};
        // 提取所有 key-value 对
        const kvMatches = content.matchAll(
          /<arg_key>([^<]+)<\/arg_key>\s*<arg_value>([^<]+)<\/arg_value>/g
        );
        let hasArgs = false;
        for (const match of kvMatches) {
          args[match[1].trim()] = match[2].trim();
          hasArgs = true;
        }

        if (hasArgs || content.indexOf(toolName) !== -1) {
          toolCalls.push({
            id: `textcall_xml_0_${Date.now()}`,
            name: toolName,
            arguments: JSON.stringify(args),
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
export async function processToolCalls(
  toolCalls,
  executeTool,
  sendSSE,
  toolResultMsg,
  fullContent = null
) {
  const newMessages = [];

  for (const tc of toolCalls) {
    if (!tc.name) continue;

    // 通知客户端工具执行状态
    sendSSE('tool_call', { name: tc.name, status: 'started' });

    // 执行工具
    const args = parseJsonObject(tc.arguments, {});
    const result = await executeTool(tc.name, args);

    sendSSE('tool_result', { name: tc.name, summary: toolResultMsg });

    // 构造消息
    newMessages.push({
      role: 'assistant',
      content: fullContent || null,
      tool_calls: [
        { id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } },
      ],
    });
    newMessages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: JSON.stringify(result),
    });
  }

  return newMessages;
}
