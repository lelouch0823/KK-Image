import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppStatCard from '../AppStatCard.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('AppStatCard design contract', () => {
  it('normalizes legacy tone aliases into canonical shared tones', () => {
    const wrapper = mount(AppStatCard, {
      props: {
        label: 'Shipping',
        value: 12,
        variant: 'cyan',
      },
    });

    expect(wrapper.attributes('data-tone')).toBe('info');
    expect(wrapper.html()).not.toContain('cyan-500');
  });
});
