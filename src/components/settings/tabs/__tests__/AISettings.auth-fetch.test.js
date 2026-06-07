import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AISettings from '../AISettings.vue';

const mockAuthFetch = vi.fn();
const addToast = vi.fn();

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

describe('AISettings auth fetch unification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('direct fetch should not be used in manage settings')))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses authFetch for settings bootstrap and health loading', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              ai: {
                AI_API_URL: 'https://api.example.com/v1',
                AI_API_KEY: 'sk-test',
                AI_MODELS: 'gpt-4o',
                AI_DYNAMIC_FALLBACK_ENABLED: 'false',
                AI_MODEL_HEALTH_WINDOW: '20',
              },
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { models: [] } }),
      });

    mount(AISettings, {
      global: {
        stubs: {
          SettingsSection: { template: '<div><slot /><slot name="action" /></div>' },
          AppIcon: true,
        },
      },
    });

    await flushPromises();

    expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/settings');
    expect(
      mockAuthFetch.mock.calls.some(([url]) =>
        String(url).startsWith('/api/manage/settings/ai/health')
      )
    ).toBe(true);
  });
});
