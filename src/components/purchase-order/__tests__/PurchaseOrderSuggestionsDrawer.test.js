import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PurchaseOrderSuggestionsDrawer from '../PurchaseOrderSuggestionsDrawer.vue';

const t = (_key, fallback) => fallback || '';

describe('PurchaseOrderSuggestionsDrawer', () => {
  it('renders candidate cards, summary stats, and disables create CTA when no bindable orders are selected', () => {
    const suggestion = {
      product_id: 'prod-1',
      variant_id: 'variant-1',
      product_name: 'Premium Canvas Bag',
      shortage: 8,
      available_quantity: 2,
      cost_price: 25,
      suggested_purchase_price: 26,
      variant_options: { Color: 'Black' },
    };

    const wrapper = mount(PurchaseOrderSuggestionsDrawer, {
      props: {
        show: true,
        t,
        suggestionsLoading: false,
        suggestions: [suggestion],
        suggestionSummaryCards: [
          {
            key: 'candidates',
            label: '候选变体',
            value: '1',
            hint: '按当前订货缺口和库存情况筛出的待采购对象。',
          },
        ],
        selectedSuggestions: [suggestion],
        selectedSuggestionOrderIds: [],
        buildSuggestionMeta: () => 'SKU · Canvas',
        buildSuggestionVariantLabel: () => 'Color: Black',
        getSuggestionOrderIds: () => [],
      },
      global: {
        stubs: {
          Teleport: true,
          AppIcon: { template: '<i />' },
          AppCheckbox: { template: '<input type="checkbox" />' },
          StatusBadge: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-suggestions-shell"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Premium Canvas Bag');
    expect(wrapper.text()).toContain('候选变体');
    expect(wrapper.text()).toContain('Color: Black');
    expect(
      wrapper.get('[data-testid="purchase-order-suggestions-submit"]').attributes('disabled')
    ).toBeDefined();
  });
});
