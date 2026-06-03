import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { token: 'test-token' } }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: authFetchMock }),
}));

import { useSalesToken } from '../useSalesToken.js';
import { useSearch } from '../useSearch.js';
import { useTags } from '../useTags.js';
import { useWatermarkSettings } from '../useWatermarkSettings.js';

describe('light composables behavior', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    vi.useFakeTimers();

    const search = useSearch();
    search.searchQuery.value = '';
    search.searchResults.value = [];
    search.isSearching.value = false;

    const tags = useTags();
    tags.tags.value = [];
    tags.loadingTags.value = false;

    const watermark = useWatermarkSettings();
    watermark.watermarkSettings.value = {
      WATERMARK_ENABLED: 'false',
      WATERMARK_TEXT: 'KK-Image',
      WATERMARK_POSITION: 'bottom-right',
      WATERMARK_OPACITY: '0.4',
      WATERMARK_COLOR: '#ffffff',
      WATERMARK_SIZE_RATIO: '0.05',
    };
    watermark.isLoaded.value = false;
    watermark.isLoading.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts the sales token from the current pathname', () => {
    window.history.replaceState({}, '', '/sales/demo-token');
    expect(useSalesToken().token.value).toBe('demo-token');

    window.history.replaceState({}, '', '/admin/dashboard');
    expect(useSalesToken().token.value).toBeNull();
  });

  it('performs search requests and clears results for empty queries or failed responses', async () => {
    const search = useSearch();
    authFetchMock.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'r-1' }] }),
    });

    search.searchQuery.value = 'desk';
    await nextTick();
    vi.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(authFetchMock).toHaveBeenCalledWith('/api/manage/search?q=desk');
    expect(search.searchResults.value).toEqual([{ id: 'r-1' }]);
    expect(search.isSearching.value).toBe(false);

    authFetchMock.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ success: false }),
    });
    await search.performSearch('empty');
    expect(search.searchResults.value).toEqual([]);

    authFetchMock.mockRejectedValueOnce(new Error('network'));
    await search.performSearch('broken');
    expect(search.searchResults.value).toEqual([]);

    await search.performSearch('');
    expect(search.searchResults.value).toEqual([]);
  });

  it('fetches tags, creates sorted tags, and proxies assign/remove requests', async () => {
    const tags = useTags();
    authFetchMock
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ success: true, data: [{ id: 't-1', name: 'Beta' }] }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 't-2', name: 'Alpha', color: '#fff' },
        }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ success: true }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ success: true }),
      });

    await tags.fetchTags();
    expect(tags.tags.value).toEqual([{ id: 't-1', name: 'Beta' }]);
    expect(tags.loadingTags.value).toBe(false);

    const created = await tags.createTag('Alpha', '#fff');
    expect(created).toEqual({ id: 't-2', name: 'Alpha', color: '#fff' });
    expect(tags.tags.value.map((tag) => tag.name)).toEqual(['Alpha', 'Beta']);

    await expect(tags.assignTag('file-1', 't-1')).resolves.toEqual({ success: true });
    await expect(tags.removeTag('file-1', 't-1')).resolves.toEqual({ success: true });

    expect(authFetchMock).toHaveBeenNthCalledWith(3, '/api/manage/tags/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: 'file-1', tag_id: 't-1' }),
    });
    expect(authFetchMock).toHaveBeenNthCalledWith(4, '/api/manage/tags/assign', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: 'file-1', tag_id: 't-1' }),
    });
  });

  it('surfaces tag creation failures and leaves loading state consistent on fetch errors', async () => {
    const tags = useTags();
    const error = new Error('duplicate');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    authFetchMock.mockRejectedValueOnce(new Error('fetch failed'));
    await tags.fetchTags();
    expect(tags.loadingTags.value).toBe(false);

    authFetchMock.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ success: false, error: 'duplicate' }),
    });
    await expect(tags.createTag('Dup', '#000')).rejects.toThrow('duplicate');
    expect(consoleError).toHaveBeenCalled();
  });

  it('loads watermark settings with caching, force refresh, and parsed defaults', async () => {
    const watermark = useWatermarkSettings();
    authFetchMock.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          watermark: {
            WATERMARK_ENABLED: 'true',
            WATERMARK_TEXT: 'Demo',
            WATERMARK_POSITION: '',
            WATERMARK_OPACITY: '0.6',
            WATERMARK_COLOR: '',
            WATERMARK_SIZE_RATIO: '0.08',
          },
        },
      }),
    });

    const loaded = await watermark.loadSettings();
    expect(loaded).toMatchObject({
      WATERMARK_ENABLED: 'true',
      WATERMARK_TEXT: 'Demo',
      WATERMARK_POSITION: 'bottom-right',
      WATERMARK_OPACITY: '0.6',
      WATERMARK_COLOR: '#ffffff',
      WATERMARK_SIZE_RATIO: '0.08',
    });
    expect(watermark.isLoaded.value).toBe(true);
    expect(watermark.getSettingsParsed()).toEqual({
      enabled: true,
      text: 'Demo',
      position: 'bottom-right',
      opacity: 0.6,
      color: '#ffffff',
      sizeRatio: 0.08,
    });

    await watermark.loadSettings();
    expect(authFetchMock).toHaveBeenCalledTimes(1);

    authFetchMock.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ success: false }),
    });
    await watermark.loadSettings(true);
    expect(authFetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns existing watermark settings when already loading and tolerates load failures', async () => {
    const watermark = useWatermarkSettings();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    watermark.isLoading.value = true;
    const snapshot = await watermark.loadSettings();
    expect(snapshot).toBe(watermark.watermarkSettings.value);

    watermark.isLoading.value = false;
    authFetchMock.mockRejectedValueOnce(new Error('settings down'));
    await expect(watermark.loadSettings(true)).resolves.toBe(watermark.watermarkSettings.value);
    expect(consoleWarn).toHaveBeenCalled();
    expect(watermark.isLoading.value).toBe(false);
  });
});
