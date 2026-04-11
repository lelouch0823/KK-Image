import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductGrid from '../ProductGrid.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('ProductGrid available stock projection', () => {
  it('prefers available_quantity for mobile stock display and low-stock badge', () => {
    const wrapper = mount(ProductGrid, {
      props: {
        products: [
          {
            id: 'p-1',
            name: 'Chair',
            spu: 'SPU-1',
            status: 'active',
            price: 100,
            stock_quantity: 10,
            available_quantity: 2,
            alert_threshold: 3,
          },
        ],
      },
      global: {
        stubs: {
          AppImage: { template: '<img />' },
          AppIcon: { template: '<i />' },
          StatusBadge: { template: '<span><slot /></span>' },
        },
      },
    });

    expect(wrapper.text()).toContain('product.table.header.stock: 2');
    expect(wrapper.text()).toContain('product.stats.low_stock');
    expect(wrapper.text()).not.toContain('product.table.header.stock: 10');
  });

  it('does not show low-stock badge when alert_threshold is explicitly zero', () => {
    const wrapper = mount(ProductGrid, {
      props: {
        products: [
          {
            id: 'p-1',
            name: 'Chair',
            spu: 'SPU-1',
            status: 'active',
            price: 100,
            stock_quantity: 10,
            available_quantity: 2,
            alert_threshold: 0,
          },
        ],
      },
      global: {
        stubs: {
          AppImage: { template: '<img />' },
          AppIcon: { template: '<i />' },
          StatusBadge: { template: '<span><slot /></span>' },
        },
      },
    });

    expect(wrapper.text()).toContain('product.table.header.stock: 2');
    expect(wrapper.text()).not.toContain('product.stats.low_stock');
  });
});
