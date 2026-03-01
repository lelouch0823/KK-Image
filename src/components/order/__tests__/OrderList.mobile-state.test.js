import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderList from '@/components/order/OrderList.vue';

const mountList = (props = {}) =>
  mount(OrderList, {
    props: {
      orders: [],
      loading: false,
      isPulling: false,
      loadingMore: false,
      ...props,
    },
    global: {
      stubs: {
        AppIcon: true,
        AppImage: true,
        StatusBadge: true,
        Skeleton: true,
      },
      mocks: {
        t: (key) => key,
      },
    },
  });

describe('OrderList mobile state UX', () => {
  it('shows retry CTA on list load error', async () => {
    const wrapper = mountList({ error: 'load failed' });
    expect(wrapper.find('[data-testid="async-error"]').exists()).toBe(true);

    await wrapper.get('[data-testid="retry-action"]').trigger('click');
    expect(wrapper.emitted('refresh')).toBeTruthy();
  });

  it('shows empty guidance instead of blank state', () => {
    const wrapper = mountList();
    expect(wrapper.find('[data-testid="async-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('order.portal.emptyHint');
  });
});
