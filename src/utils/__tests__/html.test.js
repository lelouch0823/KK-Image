import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../html';

describe('escapeHtml', () => {
  it('escapes all HTML special characters including single quotes', () => {
    expect(escapeHtml(`<a href="x" onclick='alert("1&2")'>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;alert(&quot;1&amp;2&quot;)&#39;&gt;'
    );
  });

  it('escapes single quotes to prevent attribute breakout', () => {
    expect(escapeHtml("'}; alert(1); {'")).toBe("&#39;}; alert(1); {&#39;");
  });

  it('keeps safe text untouched', () => {
    expect(escapeHtml('普通文本 123')).toBe('普通文本 123');
  });

  it('handles numbers and nullish values', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
