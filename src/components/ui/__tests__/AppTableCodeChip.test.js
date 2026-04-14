import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTableCodeChip from '../AppTableCodeChip.vue';

describe('AppTableCodeChip', () => {
  it('renders a truncated monospace chip with max width and title fallback', () => {
    const wrapper = mount(AppTableCodeChip, {
      props: {
        value: 'SKU-ALPHA-BETA',
        maxWidth: '11rem',
      },
    });

    expect(wrapper.classes()).toContain('truncate');
    expect(wrapper.classes()).toContain('whitespace-nowrap');
    expect(wrapper.classes()).toContain('font-mono');
    expect(wrapper.attributes('title')).toBe('SKU-ALPHA-BETA');
    expect(wrapper.attributes('style')).toContain('max-width: 11rem;');
  });

  it('supports selectable secondary and main tone variants', () => {
    const wrapper = mount(AppTableCodeChip, {
      props: {
        value: 'SPU-001',
        selectable: true,
        size: 'sm',
        tone: 'main',
      },
    });

    expect(wrapper.classes()).toContain('select-all');
    expect(wrapper.classes()).toContain('text-(--text-main)');
    expect(wrapper.classes()).toContain('text-sm');
  });
});
