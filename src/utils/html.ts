/**
 * HTML 转义工具（防止 XSS 注入）
 */

/**
 * 转义 HTML 特殊字符
 * @param str - 需要转义的字符串
 * @returns 转义后的安全字符串
 */
export function escapeHtml(str: string | number | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
