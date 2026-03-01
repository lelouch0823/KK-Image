import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SalesStats from '@/components/order/SalesStats.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('SalesStats error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stats panel displays retry UI on request error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const wrapper = mount(SalesStats, {
      props: { token: 'sales-token' },
    });

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="stats-error"]').exists()).toBe(true);
    });
    expect(wrapper.find('[data-testid="stats-retry"]').exists()).toBe(true);
  });
});
