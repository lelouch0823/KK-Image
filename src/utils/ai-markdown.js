/**
 * AI Markdown 渲染工具
 * 包含针对 AI 输出的预处理，确保各类 Markdown 语法正确渲染
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 配置 Marked
marked.setOptions({
    breaks: true, // 允许 GitHub 风格的换行
    gfm: true,    // 启用 GitHub 风格 Markdown
});

/**
 * 渲染 Markdown 内容为安全的 HTML
 */
export function renderMarkdown(content) {
    if (!content) return '';

    let processed = content;

    // === 预处理 1：修复加粗/斜体标记 ===
    // AI 可能产生带空格或换行的加粗标记 (e.g. ** text ** -> **text**)
    processed = processed.replace(/\*\*\s*([\s\S]*?)\s*\*\*/g, (_, p1) => `**${p1.trim()}**`);
    processed = processed.replace(/\*\s*([^\s*][^*]*?)\s*\*/g, (_, p1) => `*${p1.trim()}*`);

    // === 预处理 2：确保块级元素前有空行 ===
    // 1. 强制在看似列表项的数字前换行 (例如 "Text1. Item" -> "Text\n\n1. Item")
    processed = processed.replace(/([^\n])(\d+\.\s)/g, '$1\n\n$2');

    // 2. 强制在无序列表项前换行 (例如 "Text- Item" -> "Text\n\n- Item")
    processed = processed.replace(/([^\n])([-*]\s)/g, '$1\n\n$2');

    // 3. 强制在标题前换行
    processed = processed.replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2');

    // 4. 表格 (以 | 开头)，但要小心不误伤正文中的 |
    processed = processed.replace(/([^\n])\n(\|)/g, '$1\n\n$2');

    // 5. 代码块和引用
    processed = processed.replace(/([^\n])(```)/g, '$1\n\n$2');
    processed = processed.replace(/([^\n])(>\s)/g, '$1\n\n$2');

    // === 预处理 3：处理中文标点后的列表 ===
    processed = processed.replace(/(：)(\d+\.\s)/g, '$1\n\n$2');
    processed = processed.replace(/(：)([-*]\s)/g, '$1\n\n$2');
    processed = processed.replace(/(。)(\d+\.\s)/g, '$1\n\n$2');
    processed = processed.replace(/(。)([-*]\s)/g, '$1\n\n$2');

    const html = marked.parse(processed);
    return DOMPurify.sanitize(html);
}
