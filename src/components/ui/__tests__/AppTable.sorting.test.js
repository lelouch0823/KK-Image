import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTable from '../AppTable.vue';

describe('AppTable sorting', () => {
  it('emits sort-change when a sortable header is clicked', async () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'price', label: 'Price', sortable: true }],
        data: [{ id: 1, price: 100 }],
      },
    });

    await wrapper.get('th').trigger('click');

    expect(wrapper.emitted('sort-change')?.[0]).toEqual([{ sortBy: 'price', sortOrder: 'asc' }]);
  });
});
