import { describe, expect, it } from 'vitest';
import { fixIncompleteMarkdown, renderMarkdown } from '../ai-markdown.js';

describe('ai markdown utils', () => {
  it('returns an empty string for empty markdown content', () => {
    expect(renderMarkdown('')).toBe('');
    expect(fixIncompleteMarkdown('')).toBe('');
  });

  it('removes internal ai tags and report markers before rendering', () => {
    const html = renderMarkdown(
      '[REPORT_AVAILABLE]<think>secret</think><tools>hidden</tools>保留内容'
    );

    expect(html).not.toContain('REPORT_AVAILABLE');
    expect(html).not.toContain('<think>');
    expect(html).not.toContain('<tools>');
    expect(html).toContain('保留内容');
  });

  it('normalizes inline emphasis markers with stray spaces', () => {
    const html = renderMarkdown(['** 粗体内容 **', '* 斜体内容 *'].join('\n\n'));

    expect(html).toContain('<strong>粗体内容</strong>');
    expect(html).toContain('<em>斜体内容</em>');
  });

  it('adds block separation for lists, headings, tables, code blocks, and quotes', () => {
    const html = renderMarkdown(
      [
        '说明1. 第一项',
        '结论-第二项',
        '正文# 标题',
        '表格说明',
        '| 列名 |',
        '| --- |',
        '| 值 |',
        '代码```js',
        'console.log(1)',
        '```',
        '引用> 一段引用',
      ].join('\n')
    );

    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<h1');
    expect(html).toContain('<table>');
    expect(html).toContain('<pre><code');
    expect(html).toContain('<blockquote>');
  });

  it('sanitizes unsafe html fragments after markdown rendering', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)" /><script>alert(1)</script>');

    expect(html).toContain('<img');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script>');
  });

  it('closes unterminated code fences and leaves complete markdown untouched', () => {
    expect(fixIncompleteMarkdown('```js\nconst a = 1;')).toBe('```js\nconst a = 1;\n```');
    expect(fixIncompleteMarkdown('```js\nconst a = 1;\n```')).toBe('```js\nconst a = 1;\n```');
  });
});
