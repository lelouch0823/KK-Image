import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTable from '../AppTable.vue';

describe('AppTable design contract', () => {
  it('renders a stable empty state using shared iconography', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [],
      },
    });

    expect(wrapper.text()).toContain('暂无数据');
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});
