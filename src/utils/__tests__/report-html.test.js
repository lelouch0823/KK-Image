import { describe, expect, it } from 'vitest';
import { sanitizeReportHtml } from '../report-html';

const REPORT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>周度报告</title>
  <style>body { font-family: sans-serif; color: #333; }</style>
</head>
<body>
  <h1>周度报告</h1>
  <p onclick="stealToken()">正常段落</p>
  <img src="x" onerror="alert(1)">
  <a href="javascript:alert(1)">恶意链接</a>
  <script>alert(document.cookie)</script>
  <iframe src="https://evil.example"></iframe>
  <object data="https://evil.example"></object>
</body>
</html>`;

describe('sanitizeReportHtml', () => {
  it('strips script tags, event handlers, javascript: URLs and embedded objects', () => {
    const clean = sanitizeReportHtml(REPORT_HTML);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert(document.cookie)');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<object');
  });

  it('keeps document structure, headings and inline styles', () => {
    const clean = sanitizeReportHtml(REPORT_HTML);

    expect(clean).toContain('<html');
    expect(clean).toContain('<head');
    expect(clean).toContain('<body');
    expect(clean).toContain('<style>');
    expect(clean).toContain('font-family: sans-serif');
    expect(clean).toContain('<h1>周度报告</h1>');
    expect(clean).toContain('正常段落');
  });

  it('injects a CSP meta tag into the head as defense in depth', () => {
    const clean = sanitizeReportHtml(REPORT_HTML);

    expect(clean).toContain('Content-Security-Policy');
    // CSP meta 注入在 head 内、body 内容之前
    const headIndex = clean.indexOf('<head');
    const metaIndex = clean.indexOf('Content-Security-Policy');
    const bodyIndex = clean.indexOf('<body');
    expect(metaIndex).toBeGreaterThan(headIndex);
    expect(metaIndex).toBeLessThan(bodyIndex);
  });

  it('injects the CSP meta tag before body content for bare fragments', () => {
    // WHOLE_DOCUMENT 会为裸片段补齐 html/head/body 结构
    const clean = sanitizeReportHtml('<p>片段</p>');

    expect(clean).toContain('Content-Security-Policy');
    expect(clean.indexOf('Content-Security-Policy')).toBeLessThan(clean.indexOf('<body'));
    expect(clean).toContain('<p>片段</p>');
  });

  it('returns an empty string for empty or non-string input', () => {
    expect(sanitizeReportHtml('')).toBe('');
    // @ts-expect-error 运行时兜底非字符串输入
    expect(sanitizeReportHtml(null)).toBe('');
  });
});
