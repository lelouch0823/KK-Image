import { afterEach, describe, expect, it, vi } from 'vitest';
import { openInNewTab, openWritableNewTab } from '../browser';

describe('browser window helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens URL tabs with noopener and noreferrer semantics', () => {
    const opened = { opener: window };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(opened);

    const result = openInNewTab('/space/token-1');

    expect(openSpy).toHaveBeenCalledWith('/space/token-1', '_blank', 'noopener,noreferrer');
    expect(result).toBe(opened);
    expect(opened.opener).toBe(null);
  });

  it('opens writable tabs with opener detached before callers write content', () => {
    const opened = { opener: window, document: {} };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(opened);

    const result = openWritableNewTab();

    expect(openSpy).toHaveBeenCalledWith('', '_blank', 'popup');
    expect(result).toBe(opened);
    expect(opened.opener).toBe(null);
  });

  it.each(['https://example.com/a', 'http://example.com/a', 'blob:https://app.example/uuid'])(
    'allows whitelisted scheme URLs: %s',
    (url) => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      expect(openInNewTab(url)).toBe(null);
      expect(openSpy).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    }
  );

  it.each([
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example.com/page',
  ])('blocks dangerous URL schemes: %s', (url) => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(openInNewTab(url)).toBe(null);
    expect(openSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('blocks empty URLs', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openInNewTab('')).toBe(null);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
