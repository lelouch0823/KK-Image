import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AISettings from '../AISettings.vue';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

const jsonResponse = (payload) => ({
  json: vi.fn().mockResolvedValue(payload),
});

const mountComponent = async (fetchResponses) => {
  const fetchMock = vi.fn();
  const defaultHealthPayload = { success: true, data: { models: [] } };
  for (const response of fetchResponses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(response));
  }
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(defaultHealthPayload)));
  vi.stubGlobal('fetch', fetchMock);

  const wrapper = mount(AISettings, {
    global: {
      stubs: {
        SettingsSection: { template: '<div><slot /></div>' },
        AppIcon: true,
      },
    },
  });

  await flushPromises();
  return { wrapper, fetchMock };
};

describe('AISettings model selection and priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches models and hydrates selected models list', async () => {
    const { wrapper, fetchMock } = await mountComponent([
      {
        success: true,
        data: {
          ai: {
            AI_API_URL: 'https://api.example.com/v1',
            AI_API_KEY: 'sk-test',
            AI_MODELS: '',
            AI_DYNAMIC_FALLBACK_ENABLED: 'false',
            AI_MODEL_HEALTH_WINDOW: '20',
          },
        },
      },
      {
        success: true,
        data: { models: [] },
      },
      {
        success: true,
        data: { models: ['gpt-4o', 'gpt-4o-mini'] },
      },
      {
        success: true,
        data: { models: [] },
      },
    ]);

    await wrapper.vm.fetchModels();

    const fetchModelsCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/manage/settings/ai/models');
    expect(fetchModelsCalls).toHaveLength(1);
    expect(wrapper.vm.availableModels).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(wrapper.vm.selectedFetchedModel).toBe('gpt-4o');
    expect(wrapper.vm.form.AI_MODELS).toBe('gpt-4o, gpt-4o-mini');
  });

  it('adds model from dropdown with dedupe guard', async () => {
    const { wrapper } = await mountComponent([
      {
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
      },
    ]);

    wrapper.vm.availableModels = ['gpt-4o', 'gpt-4o-mini'];
    wrapper.vm.selectedFetchedModel = 'gpt-4o';
    await wrapper.vm.appendSelectedModel();

    expect(wrapper.vm.form.AI_MODELS).toBe('gpt-4o');
    expect(mocks.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));

    wrapper.vm.selectedFetchedModel = 'gpt-4o-mini';
    await wrapper.vm.appendSelectedModel();

    expect(wrapper.vm.form.AI_MODELS).toBe('gpt-4o, gpt-4o-mini');
    expect(mocks.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('reorders selected models by drag-drop priority', async () => {
    const { wrapper } = await mountComponent([
      {
        success: true,
        data: {
          ai: {
            AI_API_URL: '',
            AI_API_KEY: '',
            AI_MODELS: 'model-a, model-b, model-c',
            AI_DYNAMIC_FALLBACK_ENABLED: 'false',
            AI_MODEL_HEALTH_WINDOW: '20',
          },
        },
      },
    ]);

    wrapper.vm.onDragStart(2);
    wrapper.vm.onDrop(0);

    expect(wrapper.vm.form.AI_MODELS).toBe('model-c, model-a, model-b');
  });

  it('pins model to top as primary', async () => {
    const { wrapper } = await mountComponent([
      {
        success: true,
        data: {
          ai: {
            AI_API_URL: '',
            AI_API_KEY: '',
            AI_MODELS: 'model-a, model-b, model-c',
            AI_DYNAMIC_FALLBACK_ENABLED: 'false',
            AI_MODEL_HEALTH_WINDOW: '20',
          },
        },
      },
    ]);

    wrapper.vm.pinModelAsPrimary('model-c');
    expect(wrapper.vm.form.AI_MODELS).toBe('model-c, model-a, model-b');
  });

  it('saves dynamic fallback options with ai settings batch payload', async () => {
    const { wrapper, fetchMock } = await mountComponent([
      {
        success: true,
        data: {
          ai: {
            AI_API_URL: 'https://api.example.com/v1',
            AI_API_KEY: 'sk-test',
            AI_MODELS: 'model-a, model-b',
            AI_DYNAMIC_FALLBACK_ENABLED: 'false',
            AI_MODEL_HEALTH_WINDOW: '20',
          },
        },
      },
      {
        success: true,
      },
    ]);

    wrapper.vm.form.AI_DYNAMIC_FALLBACK_ENABLED = 'true';
    wrapper.vm.form.AI_MODEL_HEALTH_WINDOW = 35;
    await wrapper.vm.saveSettings();

    const batchCall = fetchMock.mock.calls.find(([url]) => url === '/api/manage/settings/batch');
    const requestBody = JSON.parse(batchCall[1].body);
    const keys = requestBody.settings.map((item) => item.key);
    expect(keys).toContain('AI_DYNAMIC_FALLBACK_ENABLED');
    expect(keys).toContain('AI_MODEL_HEALTH_WINDOW');
  });
});
