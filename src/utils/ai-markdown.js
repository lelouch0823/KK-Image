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

    // === 预处理 0：移除报告标记 ===
    processed = processed.replace(/\[REPORT_AVAILABLE\]/g, '');

    // === 预处理 1：修复加粗/斜体标记 ===
    // AI 可能产生带空格或换行的加粗标记 (e.g. ** text ** -> **text**)
    processed = processed.replace(/\*\*\s*([\s\S]*?)\s*\*\*/g, (_, p1) => `**${p1.trim()}**`);
    processed = processed.replace(/\*\s*([^\s*][^*]*?)\s*\*/g, (_, p1) => `*${p1.trim()}*`);

    // === 预处理 2：确保块级元素前有空行 ===
    // 1. 强制在看似列表项的数字前换行 (例如 "Text1. Item" -> "Text\n\n1. Item")
    processed = processed.replace(/([^\n])(\d+\.\s)/g, '$1\n\n$2');

    // 2. 处理无序列表项
    // Step A: 紧凑列表修复 - 在 "-" 和后续非空格字符之间插入空格
    // 例如: "：-本周" -> "： - 本周"
    // 排除: "--" (破折号), "-5" (负数), "- " (已有空格)
    processed = processed.replace(/([^\d\s-])-([^\s\d-])/g, '$1 - $2');

    // Step B: 行首/空格后的紧凑列表修复
    // 例如: " -本周" -> " - 本周", 但保留 "- 正确格式"
    processed = processed.replace(/(^|\n|\s)-([^\s\d-])/gm, '$1- $2');

    // Step C: 确保列表项前有换行 (文字后紧跟 "- " 的情况)
    // 例如: "文字- 项目" -> "文字\n\n- 项目"
    processed = processed.replace(/([^\n\s])(\s*-\s)/g, '$1\n\n- ');

    // 3. 强制在标题前换行
    processed = processed.replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2');

    // 4. 表格处理 - 确保普通文本与表格之间有空行
    const lines = processed.split('\n');
    for (let i = 1; i < lines.length; i++) {
        const cur = lines[i].trim();
        const prev = lines[i - 1].trim();
        if (cur.startsWith('|') && prev !== '' && !prev.startsWith('|')) {
            lines[i] = '\n' + lines[i];
        }
    }
    processed = lines.join('\n');

    // 5. 代码块和引用
    processed = processed.replace(/([^\n])(```)/g, '$1\n\n$2');
    processed = processed.replace(/([^\n])(>\s)/g, '$1\n\n$2');

    // 6. 中文标点后的列表 (补充处理)
    processed = processed.replace(/(：)(\d+\.\s)/g, '$1\n\n$2');
    processed = processed.replace(/(。)(\d+\.\s)/g, '$1\n\n$2');

    // 7. 修复连续的 key：value 对 (例如 "姓名：张三所属门店：北京" -> "姓名：张三\n所属门店：北京")
    const html = marked.parse(processed);
    return DOMPurify.sanitize(html);
}

/**
 * 修复意外中断、仍未闭合的 Markdown 结构
 * 适合在网络中断或 AI 停止输出时，对源码级别的文本实体进行持久化修正
 */
export function fixIncompleteMarkdown(content) {
    if (!content) return '';
    let fixedContent = content;
    const codeBlockMatch = fixedContent.match(/```/g);
    if (codeBlockMatch && codeBlockMatch.length % 2 !== 0) {
        if (!fixedContent.endsWith('\n')) {
            fixedContent += '\n';
        }
        fixedContent += '```';
    }
    return fixedContent;
}
