/**
 * 文本高亮工具函数
 * @module utils/highlight
 */

/**
 * 高亮文本中的关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 关键词
 * @param {string} className - 高亮 CSS 类名
 * @returns {string} 包含 <mark> 标签的 HTML
 */
export function highlightText(
  text,
  keyword,
  className = 'bg-yellow-200 text-yellow-900 rounded px-0.5'
) {
  if (!text || !keyword) return text || '';

  // 转义正则特殊字符
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 使用 flags 'gi' 进行全局、不区分大小写匹配
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');

  return text.replace(regex, `<mark class="${className}">$1</mark>`);
}

/**
 * Vue 组件使用的高亮渲染函数
 * 返回可直接 v-html 使用的内容
 * @param {string} text - 原始文本
 * @param {string} keyword - 关键词
 * @returns {string}
 */
export function createHighlightedHtml(text, keyword) {
  return highlightText(text, keyword);
}

/**
 * 检查文本是否包含关键词 (不区分大小写)
 * @param {string} text - 原始文本
 * @param {string} keyword - 关键词
 * @returns {boolean}
 */
export function textContainsKeyword(text, keyword) {
  if (!text || !keyword) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}
