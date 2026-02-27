import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import DimensionArchiveModal from '../DimensionArchiveModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

const ModalStub = defineComponent({
  name: 'Modal',
  emits: ['update:modelValue'],
  template: `<div><slot /></div>`,
});

describe('DimensionArchiveModal event contract', () => {
  const baseWizard = () => ({
    open: true,
    step: 1,
    optionIndex: 0,
    optionId: 'dim-color',
    affectedVariantsCount: 2,
    sampleVariants: [{ id: 'v1', sku: 'SKU-1', options_values: { Color: 'Red' } }],
    mode: 'archive_variants',
    loading: false,
  });

  it('moves step 1 -> step 2 on next and emits confirm on confirm button', async () => {
    const wizard = baseWizard();
    const wrapper = mount(DimensionArchiveModal, {
      props: {
        wizard,
        formatVariantSample: vi.fn(() => 'SKU-1 · Red'),
      },
      global: {
        stubs: {
          Modal: ModalStub,
        },
      },
    });

    await wrapper.find('[data-testid="dimension-archive-next"]').trigger('click');
    expect(wizard.step).toBe(2);

    await wrapper.find('[data-testid="dimension-archive-confirm"]').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('emits close from cancel and Modal close event, and step 2 -> step 1 on back', async () => {
    const wizard = { ...baseWizard(), step: 2 };
    const wrapper = mount(DimensionArchiveModal, {
      props: {
        wizard,
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
    expect(wrapper.emitted('close')).toHaveLength(1);

    await buttons[1].trigger('click');
    expect(wizard.step).toBe(1);

    await wrapper.findComponent(ModalStub).vm.$emit('update:modelValue', false);
    expect(wrapper.emitted('close')).toHaveLength(2);
  });
});

