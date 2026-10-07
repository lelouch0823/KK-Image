/**
 * AI 报告 HTML 消毒工具
 * 报告是服务端/AI 生成的完整 HTML 文档，经 blob: URL 打开时会继承应用 origin，
 * 未经消毒的注入脚本可以应用身份执行（读 localStorage、发已认证请求），必须先过滤。
 */
import DOMPurify from 'dompurify';

// 纵深防御：注入 CSP meta，即使有漏网内容也无法执行脚本或发起外联请求
const CSP_META_TAG =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: https:">';

// 报告仅用于展示：脚本/内嵌对象/外部引用等危险标签一律剥除，结构与样式保留
const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'link'];

/**
 * 消毒完整 HTML 报告文档并注入 CSP meta
 * 保留 html/head/body/style 结构，剥除 script、on* 事件属性、javascript: URL 等
 */
export function sanitizeReportHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS,
  });

  // CSP meta 加在消毒结果之后，避免被 sanitize 剥除
  if (/<head[^>]*>/i.test(clean)) {
    return clean.replace(/<head[^>]*>/i, (match: string) => `${match}${CSP_META_TAG}`);
  }
  // 兜底：无 head 结构的片段则前置注入
  return `${CSP_META_TAG}${clean}`;
}
