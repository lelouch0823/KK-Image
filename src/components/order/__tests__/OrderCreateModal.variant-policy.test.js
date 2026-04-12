import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderCreateModal from '@/components/OrderCreateModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('OrderCreateModal variant policy', () => {
  it('always uses allow_out_of_stock policy for preorder entry', () => {
    const wrapper = mount(OrderCreateModal, {
      props: {
        modelValue: true,
        salespersons: [],
        statuses: [],
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot /></div>',
          },
          ProductBindingSection: {
            props: ['variantSelectPolicy'],
            template: '<div data-testid="variant-policy">{{ variantSelectPolicy }}</div>',
          },
          OrderForm: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="variant-policy"]').text()).toBe('allow_out_of_stock');
  });

  it('locks all snapshot-controlled fields after product binding', async () => {
    const wrapper = mount(OrderCreateModal, {
      props: {
        modelValue: true,
        salespersons: [],
        statuses: [],
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot /></div>',
          },
          ProductBindingSection: {
            template: '<button data-testid="select-product" @click="$emit(\'select\', product)">pick</button>',
            data() {
              return {
                product: {
                  id: 'prod-1',
                  name: 'Desk',
                  brand: 'ACME',
                  series: 'Series A',
                  dimension_map: { size: 'size', Color: 'Color', Material: 'Material' },
                  selectedVariant: {
                    id: 'var-1',
                    sku: 'SKU-1',
                    options_values: { size: 'L', Color: 'Red', Material: 'Cotton' },
                  },
                },
              };
            },
          },
          OrderForm: {
            props: ['disabledFields'],
            template: '<div data-testid="disabled-fields">{{ JSON.stringify(disabledFields) }}</div>',
          },
        },
      },
    });

    await wrapper.get('[data-testid="select-product"]').trigger('click');

    const disabledFields = wrapper.get('[data-testid="disabled-fields"]').text();
    expect(disabledFields).toContain('name');
    expect(disabledFields).toContain('brand');
    expect(disabledFields).toContain('series');
    expect(disabledFields).toContain('sku');
    expect(disabledFields).toContain('size');
    expect(disabledFields).toContain('color');
    expect(disabledFields).toContain('material');
  });

  it('clears bound variant snapshot after closing and reopening', async () => {
    const wrapper = mount(OrderCreateModal, {
      props: {
        modelValue: true,
        salespersons: [],
        statuses: [],
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot /></div>',
          },
          ProductBindingSection: {
            template: '<button data-testid="select-product" @click="$emit(\'select\', product)">pick</button>',
            data() {
              return {
                product: {
                  id: 'prod-1',
                  name: 'Desk',
                  brand: 'ACME',
                  series: 'Series A',
                  dimension_map: { Color: 'Color' },
                  selectedVariant: {
                    id: 'var-1',
                    sku: 'SKU-1',
                    options_values: { Color: 'Red' },
                  },
                },
              };
            },
          },
          OrderForm: {
            props: ['boundProductVariant', 'prefill'],
            template: `
              <div>
                <div data-testid="bound-variant">{{ JSON.stringify(boundProductVariant) }}</div>
                <div data-testid="prefill">{{ JSON.stringify(prefill) }}</div>
              </div>
            `,
          },
        },
      },
    });

    await wrapper.get('[data-testid="select-product"]').trigger('click');
    expect(wrapper.get('[data-testid="bound-variant"]').text()).toContain('Red');

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });

    expect(wrapper.get('[data-testid="bound-variant"]').text()).toBe('null');
    expect(wrapper.get('[data-testid="prefill"]').text()).toBe('{}');
  });
});
