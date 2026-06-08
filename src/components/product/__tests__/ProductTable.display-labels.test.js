import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductTable from '../ProductTable.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@vueuse/core', () => ({
  breakpointsTailwind: {},
  useBreakpoints: () => ({
    greater: () => ({ value: true }),
  }),
}));

describe('ProductTable display labels', () => {
  it('renders unknown product status as a readable label instead of an i18n key', () => {
    const wrapper = mount(ProductTable, {
      props: {
        products: [
          {
            id: 'p-1',
            name: 'Chair',
            spu: 'SPU-1',
            status: 'seasonal_archive_review',
            price: 100,
            stock_quantity: 10,
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: { template: '<i />' },
          AppImage: { template: '<img />' },
          AppTable: {
            props: ['columns', 'data'],
            template: `
              <div>
                <div v-for="row in data" :key="row.id">
                  <slot name="cell-product" :row="row" />
                  <slot name="cell-status" :value="row.status" :row="row" />
                  <slot name="cell-actions" :row="row" />
                </div>
              </div>
            `,
          },
          AppTableCodeChip: { props: ['value'], template: '<span>{{ value }}</span>' },
          AppTableStatusPill: {
            props: ['label', 'title'],
            template: '<span :title="title">{{ label }}</span>',
          },
          StatusBadge: { props: ['label'], template: '<span>{{ label }}<slot /></span>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Seasonal Archive Review');
    expect(wrapper.text()).not.toContain('product.filters.status.seasonal_archive_review');
    expect(wrapper.text()).not.toContain('seasonal_archive_review');
  });
});
