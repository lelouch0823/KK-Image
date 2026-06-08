import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Select from '../Select.vue';

describe('Select attrs', () => {
  it('forwards test attributes to the trigger wrapper for smoke automation', () => {
    const wrapper = mount(Select, {
      props: {
        modelValue: '',
        options: [
          { label: 'Ignore', value: '' },
          { label: '颜色', value: '颜色' },
        ],
      },
      attrs: {
        'data-testid': 'product-import-spec-column-0',
      },
    });

    const selectRoot = wrapper.get('[data-testid="product-import-spec-column-0"]');

    expect(selectRoot.get('button[role="combobox"]').exists()).toBe(true);
  });
});
