import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { useFeatureFlag, useFeatureFlags, clearFeatureFlagCache } from '../useFeatureFlag';

// Mock useAuth
const mockAuthFetch = vi.fn();
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
  }),
}));

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeatureFlagCache();
  });

  describe('useFeatureFlag(key)', () => {
    it('returns false when flag does not exist', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: [] }),
      });

      const { isEnabled } = useFeatureFlag('nonexistent');
      await nextTick();
      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      expect(isEnabled.value).toBe(false);
    });

    it('returns true when flag is enabled', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ key: 'new-order-flow', enabled: true, description: null }],
        }),
      });

      const { isEnabled } = useFeatureFlag('new-order-flow');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      expect(isEnabled.value).toBe(true);
    });

    it('returns false when flag is disabled', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ key: 'dark-mode', enabled: false, description: null }],
        }),
      });

      const { isEnabled } = useFeatureFlag('dark-mode');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      expect(isEnabled.value).toBe(false);
    });

    it('refresh forces re-fetch', async () => {
      mockAuthFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: [{ key: 'test-flag', enabled: false }],
        }),
      });

      const { isEnabled, refresh } = useFeatureFlag('test-flag');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      expect(isEnabled.value).toBe(false);

      mockAuthFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: [{ key: 'test-flag', enabled: true }],
        }),
      });

      await refresh();
      await nextTick();

      expect(isEnabled.value).toBe(true);
    });
  });

  describe('useFeatureFlags()', () => {
    it('returns all flags', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [
            { key: 'flag-a', enabled: true, description: null },
            { key: 'flag-b', enabled: false, description: 'Test' },
          ],
        }),
      });

      const { flags, isEnabled } = useFeatureFlags();
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      expect(flags.value.size).toBe(2);
      expect(isEnabled('flag-a')).toBe(true);
      expect(isEnabled('flag-b')).toBe(false);
      expect(isEnabled('unknown')).toBe(false);
    });
  });

  describe('cache', () => {
    it('caches results and avoids duplicate fetches', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ key: 'cached-flag', enabled: true }],
        }),
      });

      // First call triggers fetch
      useFeatureFlag('cached-flag');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));

      // Second call should use cache
      useFeatureFlag('cached-flag');
      await nextTick();

      expect(mockAuthFetch).toHaveBeenCalledTimes(1);
    });

    it('clearFeatureFlagCache resets cache', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ key: 'test', enabled: true }],
        }),
      });

      useFeatureFlag('test');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));

      clearFeatureFlagCache();

      useFeatureFlag('test');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAuthFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));

      const { isEnabled } = useFeatureFlag('error-flag');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      // Should default to false on error
      expect(isEnabled.value).toBe(false);
    });

    it('handles unsuccessful response', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: false, data: [] }),
      });

      const { isEnabled } = useFeatureFlag('bad-response');
      await nextTick();
      await new Promise((r) => setTimeout(r, 10));
      await nextTick();

      expect(isEnabled.value).toBe(false);
    });
  });
});
