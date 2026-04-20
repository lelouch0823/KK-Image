import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import OrderLinesEditor from '@/components/order/OrderLinesEditor.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

const StickyOrderLineEditor = {
  props: ['modelValue'],
  setup(props) {
    const initialName = ref(props.modelValue.name);
    return { initialName };
  },
  template: '<div data-testid="sticky-line">{{ initialName }}</div>',
};

describe('OrderLinesEditor row identity', () => {
  it('keeps the correct row instance after removing a preceding line', async () => {
    const wrapper = mount(OrderLinesEditor, {
      props: {
        modelValue: [
          { clientId: 'line-a', name: 'Desk' },
          { clientId: 'line-b', name: 'Chair' },
        ],
        lineStates: [{}, {}],
      },
      global: {
        stubs: {
          AppButton: {
            template: '<button><slot /></button>',
          },
          OrderLineEditor: StickyOrderLineEditor,
        },
      },
    });

    expect(wrapper.findAll('[data-testid="sticky-line"]').map((node) => node.text())).toEqual([
      'Desk',
      'Chair',
    ]);

    await wrapper.setProps({
      modelValue: [{ clientId: 'line-b', name: 'Chair' }],
      lineStates: [{}],
    });

    expect(wrapper.findAll('[data-testid="sticky-line"]').map((node) => node.text())).toEqual([
      'Chair',
    ]);
  });
});
