import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchHistory } from '../useSearchHistory';

describe('useSearchHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads persisted history on initialization and returns it', () => {
    localStorage.setItem('kk-search-history-orders', JSON.stringify(['first', 'second']));

    const searchHistory = useSearchHistory();

    expect(searchHistory.history.value).toEqual(['first', 'second']);
    expect(searchHistory.getHistory()).toEqual(['first', 'second']);
  });

  it('adds trimmed queries, deduplicates them, and caps history length', () => {
    const searchHistory = useSearchHistory('products');

    searchHistory.addHistory('  alpha  ');
    searchHistory.addHistory('beta');
    searchHistory.addHistory('gamma');
    searchHistory.addHistory('delta');
    searchHistory.addHistory('epsilon');
    searchHistory.addHistory('alpha');
    searchHistory.addHistory('zeta');
    searchHistory.addHistory('');
    searchHistory.addHistory(null);

    expect(searchHistory.history.value).toEqual(['zeta', 'alpha', 'epsilon', 'delta', 'gamma']);
    expect(JSON.parse(localStorage.getItem('kk-search-history-products'))).toEqual([
      'zeta',
      'alpha',
      'epsilon',
      'delta',
      'gamma',
    ]);
  });

  it('removes single items and clears all history', () => {
    const searchHistory = useSearchHistory('customers');

    searchHistory.addHistory('alice');
    searchHistory.addHistory('bob');
    searchHistory.removeHistory('alice');

    expect(searchHistory.history.value).toEqual(['bob']);

    searchHistory.clearHistory();
    expect(searchHistory.history.value).toEqual([]);
    expect(localStorage.getItem('kk-search-history-customers')).toBeNull();
  });

  it('reloads persisted history lazily when memory state is empty', () => {
    const searchHistory = useSearchHistory('lazy');
    localStorage.setItem('kk-search-history-lazy', JSON.stringify(['persisted']));
    searchHistory.history.value = [];

    expect(searchHistory.getHistory()).toEqual(['persisted']);
  });

  it('falls back to an empty list when localStorage load fails', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });

    const searchHistory = useSearchHistory('broken');

    expect(searchHistory.history.value).toEqual([]);

    getItemSpy.mockRestore();
  });

  it('keeps state when save or clear operations fail', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('set failed');
    });
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed');
    });

    const searchHistory = useSearchHistory('limited');
    searchHistory.addHistory('alpha');
    searchHistory.clearHistory();

    expect(searchHistory.history.value).toEqual([]);

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });
});
