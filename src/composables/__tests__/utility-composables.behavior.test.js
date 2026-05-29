import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

const addToast = vi.fn();
const t = vi.fn((key) => {
  if (key === 'common.copied') return '已复制';
  if (key === 'common.copyFailed') return '复制失败';
  if (key === 'share.linkCopied') return '链接已复制';
  return key;
});

vi.mock('../useToast.js', () => ({
  useToast: () => ({ addToast }),
}));

vi.mock('../useI18n.js', () => ({
  useI18n: () => ({ t }),
}));

import { useClipboard } from '../useClipboard.js';
import { useDragSort } from '../useDragSort.js';
import { useRecentInputs } from '../useRecentInputs.js';
import { useSmoothTypewriter } from '../useSmoothTypewriter.js';

describe('utility composables behavior', () => {
  const originalSecureContext = window.isSecureContext;
  let rafCallbacks;
  let rafId;

  beforeEach(() => {
    addToast.mockReset();
    t.mockClear();
    localStorage.clear();
    rafCallbacks = new Map();
    rafId = 0;

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback) => {
        const id = ++rafId;
        rafCallbacks.set(id, callback);
        return id;
      })
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id) => {
        rafCallbacks.delete(id);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecureContext,
    });
  });

  const flushAnimationFrame = (timestamp) => {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    callbacks.forEach((callback) => callback(timestamp));
  };

  it('copies text with the modern clipboard api and builds share links', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue('from-clipboard'),
      },
    });

    const { copy, paste, copyShareLink } = useClipboard();

    await expect(copy('hello')).resolves.toBe(true);
    await expect(paste()).resolves.toBe('from-clipboard');
    await expect(copyShareLink('/space/demo')).resolves.toBe(true);
    await expect(copyShareLink('https://example.com/demo', { showToast: false })).resolves.toBe(true);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/space/demo`);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/demo');
    expect(addToast).toHaveBeenCalledWith({ message: '已复制', type: 'success' });
    expect(addToast).toHaveBeenCalledWith({ message: '链接已复制', type: 'success' });
  });

  it('falls back to execCommand and reports clipboard failures', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const execCommand = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    const { copy, copyShareLink, paste } = useClipboard();

    await expect(copy('legacy')).resolves.toBe(true);
    await expect(copy('broken')).resolves.toBe(false);
    await expect(copyShareLink('')).resolves.toBe(false);
    await expect(paste()).resolves.toBeNull();

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith({ message: '复制失败', type: 'error' });
  });

  it('loads, deduplicates, limits, and clears recent input history', () => {
    const recent = useRecentInputs('purchase-order');

    recent.saveRecent('customer', ' Alice ');
    recent.saveRecent('customer', 'Bob');
    recent.saveRecent('customer', 'Alice');
    recent.saveMultiple({
      customer: 'Carol',
      sku: 'SKU-1',
      ignore: '',
    });
    recent.saveRecent('customer', 'Dora');
    recent.saveRecent('customer', 'Eve');
    recent.saveRecent('customer', 'Frank');

    expect(recent.getRecent('customer')).toEqual(['Frank', 'Eve', 'Dora', 'Carol', 'Alice']);
    expect(recent.getRecent('sku')).toEqual(['SKU-1']);

    recent.clearField('customer');
    expect(recent.getRecent('customer')).toEqual([]);

    recent.clearAll();
    expect(recent.getRecent('sku')).toEqual([]);
  });

  it('falls back safely when recent input storage is corrupted or unavailable', () => {
    localStorage.setItem('kk-recent-inputs-order', '{bad json');
    const recent = useRecentInputs();

    expect(recent.getRecent('field')).toEqual([]);

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    recent.saveRecent('field', 'value');

    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    recent.clearAll();

    // Should not throw even when storage is unavailable
    expect(recent.getRecent('field')).toEqual([]);

    setItem.mockRestore();
    removeItem.mockRestore();
  });

  it('renders smooth typewriter output, accelerates through long buffers, and can finish/reset', () => {
    const scope = effectScope();
    const typewriter = scope.run(() => useSmoothTypewriter());

    typewriter.push('a'.repeat(80));
    expect(typewriter.fullContent.value).toHaveLength(80);
    expect(typewriter.isTyping.value).toBe(true);

    flushAnimationFrame(0);
    flushAnimationFrame(1);
    flushAnimationFrame(1001);

    expect(typewriter.displayedContent.value.length).toBeGreaterThan(0);
    expect(typewriter.displayedContent.value.length).toBeLessThanOrEqual(80);

    typewriter.finish();
    expect(typewriter.displayedContent.value).toBe('a'.repeat(80));
    expect(typewriter.isTyping.value).toBe(false);

    typewriter.reset();
    expect(typewriter.fullContent.value).toBe('');
    expect(typewriter.displayedContent.value).toBe('');
    expect(typewriter.isTyping.value).toBe(false);

    scope.stop();
  });

  it('cancels pending animation frames when the effect scope is disposed', () => {
    const scope = effectScope();
    const typewriter = scope.run(() => useSmoothTypewriter());

    typewriter.push('dispose me');
    expect(requestAnimationFrame).toHaveBeenCalled();

    scope.stop();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('handles desktop and touch drag sorting flows', () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      vibrate: vi.fn(),
    });
    const items = ref([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
    const onReorder = vi.fn();
    const dragSort = useDragSort(items, { onReorder });
    const dataTransfer = {
      effectAllowed: '',
      setData: vi.fn(),
    };

    dragSort.handleDragStart(0, { dataTransfer });
    dragSort.handleDragOver(2);
    expect(dragSort.dragOverIndex.value).toBe(2);
    dragSort.handleDrop(2);

    expect(onReorder).toHaveBeenCalledWith(
      [{ id: 'b' }, { id: 'c' }, { id: 'a' }],
      0,
      2
    );
    expect(dragSort.dragIndex.value).toBeNull();
    expect(dragSort.dragOverIndex.value).toBeNull();

    dragSort.handleDragStart(1, { dataTransfer });
    dragSort.handleDragLeave();
    dragSort.handleDrop(1);
    dragSort.handleDragEnd();
    expect(dragSort.getDragClass(1)).toBe('');

    const sortableItem = {
      dataset: { sortableIndex: '0' },
      closest: vi.fn(() => sortableItem),
    };
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => sortableItem),
    });

    dragSort.handleTouchStart(2, {});
    vi.advanceTimersByTime(500);
    dragSort.handleTouchMove({
      touches: [{ clientX: 10, clientY: 20 }],
    });
    expect(dragSort.dragOverIndex.value).toBe(0);
    expect(navigator.vibrate).toHaveBeenCalledWith(50);

    dragSort.handleTouchEnd();
    expect(onReorder).toHaveBeenCalledWith(
      [{ id: 'c' }, { id: 'a' }, { id: 'b' }],
      2,
      0
    );
    expect(dragSort.getDragClass(0)).toBe('');
  });
});
