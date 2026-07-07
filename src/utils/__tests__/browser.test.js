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
});
