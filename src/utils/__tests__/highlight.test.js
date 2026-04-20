import { describe, expect, it } from 'vitest';
import { createHighlightedHtml, highlightText, textContainsKeyword } from '../highlight.js';

describe('highlight utils', () => {
  it('returns the original text when text or keyword is missing', () => {
    expect(highlightText('', 'foo')).toBe('');
    expect(highlightText('hello', '')).toBe('hello');
    expect(highlightText(null, 'foo')).toBe('');
  });

  it('highlights all case-insensitive matches with the default class', () => {
    const html = highlightText('Hello hello', 'heLLo');

    expect(html).toBe(
      '<mark class="bg-(--color-warning-bg) text-(--color-warning-text) rounded px-0.5">Hello</mark> <mark class="bg-(--color-warning-bg) text-(--color-warning-text) rounded px-0.5">hello</mark>'
    );
  });

  it('escapes regex special characters and respects custom class names', () => {
    const html = highlightText('price [A+B]? and [a+b]?', '[A+B]?', 'custom-mark');

    expect(html).toBe('price <mark class="custom-mark">[A+B]?</mark> and <mark class="custom-mark">[a+b]?</mark>');
  });

  it('creates highlighted html via the shared highlighter', () => {
    expect(createHighlightedHtml('Needle in haystack', 'needle')).toBe(
      highlightText('Needle in haystack', 'needle')
    );
  });

  it('checks keyword existence case-insensitively', () => {
    expect(textContainsKeyword('Sales Dashboard', 'dashboard')).toBe(true);
    expect(textContainsKeyword('Sales Dashboard', 'orders')).toBe(false);
    expect(textContainsKeyword('', 'orders')).toBe(false);
    expect(textContainsKeyword('Sales Dashboard', '')).toBe(false);
  });
});
