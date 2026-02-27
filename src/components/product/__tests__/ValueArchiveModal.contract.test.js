import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import ValueArchiveModal from '../ValueArchiveModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

const ModalStub = defineComponent({
  name: 'Modal',
  emits: ['update:modelValue'],
  template: `<div><slot /></div>`,
});

describe('ValueArchiveModal event contract', () => {
  const wizard = {
    open: true,
    optionIndex: 0,
    valueIndex: 0,
    valueId: 'val-red',
    valueLabel: 'Red',
    affectedVariantsCount: 1,
    sampleVariants: [{ id: 'v1', sku: 'SKU-1', options_values: { Color: 'Red' } }],
    loading: false,
  };

  it('emits confirm and close from footer actions', async () => {
    const wrapper = mount(ValueArchiveModal, {
      props: {
        wizard: { ...wizard },
        formatVariantSample: vi.fn(() => 'SKU-1 · Red'),
      },
      global: {
        stubs: {
          Modal: ModalStub,
        },
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('emits close when Modal requests close', async () => {
    const wrapper = mount(ValueArchiveModal, {
      props: {
        wizard: { ...wizard },
        formatVariantSample: vi.fn(() => 'SKU-1 · Red'),
      },
      global: {
        stubs: {
          Modal: ModalStub,
        },
      },
    });

    await wrapper.findComponent(ModalStub).vm.$emit('update:modelValue', false);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

