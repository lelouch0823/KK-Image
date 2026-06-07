import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import WatermarkSettings from '../WatermarkSettings.vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  addToast: vi.fn(),
  loadSettings: vi.fn(),
  watermarkSettings: {
    value: {
      WATERMARK_ENABLED: 'false',
      WATERMARK_TEXT: 'KK-Image',
      WATERMARK_POSITION: 'bottom-right',
      WATERMARK_OPACITY: '0.4',
      WATERMARK_COLOR: '#ffffff',
      WATERMARK_SIZE_RATIO: '0.05',
    },
  },
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('@/composables/useWatermarkSettings', () => ({
  useWatermarkSettings: () => ({
    loadSettings: mocks.loadSettings,
    watermarkSettings: mocks.watermarkSettings,
  }),
}));

describe('WatermarkSettings behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.watermarkSettings.value = {
      WATERMARK_ENABLED: 'false',
      WATERMARK_TEXT: 'KK-Image',
      WATERMARK_POSITION: 'bottom-right',
      WATERMARK_OPACITY: '0.4',
      WATERMARK_COLOR: '#ffffff',
      WATERMARK_SIZE_RATIO: '0.05',
    };
    mocks.loadSettings.mockResolvedValue();
    mocks.authFetch.mockResolvedValue({
      json: async () => ({ success: true }),
    });
  });

  function createWrapper() {
    return mount(WatermarkSettings, {
      global: {
        stubs: {
          SettingsSection: {
            props: ['title', 'description'],
            template: `
              <section>
                <h2>{{ title }}</h2>
                <p>{{ description }}</p>
                <slot />
              </section>
            `,
          },
          AppIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
          AppCard: {
            template: '<div><slot /></div>',
          },
          ActionBar: {
            template: '<div><slot /></div>',
          },
          AppButton: {
            props: ['type', 'text', 'loading', 'variant', 'size'],
            emits: ['click'],
            template:
              '<button :type="type || \'button\'" @click="$emit(\'click\')">{{ text }}<slot name="icon-left" /><slot /></button>',
          },
          AppInput: {
            props: ['modelValue', 'type', 'placeholder'],
            emits: ['update:modelValue'],
            template: `
              <input
                data-testid="watermark-text-input"
                :type="type || 'text'"
                :placeholder="placeholder"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            `,
          },
          AppSelect: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select
                data-testid="position-select"
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
              >
                <option v-for="option in options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            `,
          },
          AppSlider: {
            props: ['modelValue', 'label', 'min', 'max', 'step'],
            emits: ['update:modelValue'],
            template: `
              <label>
                {{ label }}
                <input
                  data-testid="slider-input"
                  type="range"
                  :value="modelValue"
                  :min="min"
                  :max="max"
                  :step="step"
                  @input="$emit('update:modelValue', $event.target.value)"
                />
              </label>
            `,
          },
          AppColorInput: {
            props: ['modelValue', 'label'],
            emits: ['update:modelValue'],
            template: `
              <label>
                {{ label }}
                <input
                  data-testid="color-input"
                  type="color"
                  :value="modelValue"
                  @input="$emit('update:modelValue', $event.target.value)"
                />
              </label>
            `,
          },
        },
      },
    });
  }

  it('loads current watermark settings on mount', async () => {
    mocks.watermarkSettings.value = {
      WATERMARK_ENABLED: 'true',
      WATERMARK_TEXT: 'ACME',
      WATERMARK_POSITION: 'top-left',
      WATERMARK_OPACITY: '0.7',
      WATERMARK_COLOR: '#000000',
      WATERMARK_SIZE_RATIO: '0.08',
    };

    const wrapper = createWrapper();
    await flushPromises();

    expect(mocks.loadSettings).toHaveBeenCalledWith(true);
    expect(wrapper.get('[data-testid="watermark-text-input"]').element.value).toBe('ACME');
    expect(wrapper.get('[data-testid="position-select"]').element.value).toBe('top-left');
  });

  it('toggles watermark enable state and reveals advanced controls', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="watermark-text-input"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="slider-input"]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="color-input"]').exists()).toBe(true);
  });

  it('submits updated settings and syncs local watermark cache on success', async () => {
    mocks.watermarkSettings.value = {
      WATERMARK_ENABLED: 'true',
      WATERMARK_TEXT: 'Before',
      WATERMARK_POSITION: 'bottom-right',
      WATERMARK_OPACITY: '0.4',
      WATERMARK_COLOR: '#ffffff',
      WATERMARK_SIZE_RATIO: '0.05',
    };

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.get('[data-testid="watermark-text-input"]').setValue('After');
    await wrapper.get('[data-testid="position-select"]').setValue('center');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenCalledWith(
      '/api/manage/settings/batch',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const body = JSON.parse(mocks.authFetch.mock.calls[0][1].body);
    expect(body.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'WATERMARK_TEXT', value: 'After', category: 'watermark' }),
        expect.objectContaining({
          key: 'WATERMARK_POSITION',
          value: 'center',
          category: 'watermark',
        }),
      ])
    );
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'Settings saved successfully',
      type: 'success',
    });
    expect(mocks.watermarkSettings.value.WATERMARK_TEXT).toBe('After');
    expect(mocks.watermarkSettings.value.WATERMARK_POSITION).toBe('center');
  });

  it('shows an error toast when saving fails', async () => {
    mocks.watermarkSettings.value.WATERMARK_ENABLED = 'true';
    mocks.authFetch.mockResolvedValue({
      json: async () => ({ success: false, error: 'save failed' }),
    });

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.addToast).toHaveBeenCalledWith({ type: 'error', message: 'save failed' });
  });
});
