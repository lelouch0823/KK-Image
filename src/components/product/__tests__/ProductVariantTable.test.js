import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductVariantTable from '../ProductVariantTable.vue';

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

const baseVariants = [
    {
        id: 'v1',
        sku: 'SKU-1',
        barcode: '',
        supplier_sku: '',
        price: 10,
        cost_price: 5,
        stock_quantity: 1,
        alert_threshold: 1,
        status: 'active',
        options_values: { Color: 'Red' },
        images: [],
    },
];

describe('ProductVariantTable', () => {
    it('emits immutable update when editing field', async () => {
        const wrapper = mount(ProductVariantTable, {
            props: {
                modelValue: baseVariants,
                currencySymbol: '$',
            },
        });

        const skuInput = wrapper.find('input[placeholder="SKU"]');
        await skuInput.setValue('SKU-UPDATED');

        const updates = wrapper.emitted('update:modelValue');
        expect(updates).toBeTruthy();
        const lastPayload = updates[updates.length - 1][0];
        expect(lastPayload[0].sku).toBe('SKU-UPDATED');
        expect(baseVariants[0].sku).toBe('SKU-1');
    });

    it('renders external parent updates without losing editability', async () => {
        const wrapper = mount(ProductVariantTable, {
            props: {
                modelValue: baseVariants,
            },
        });

        await wrapper.setProps({
            modelValue: [
                {
                    ...baseVariants[0],
                    sku: 'SKU-FROM-PARENT',
                    price: 20,
                },
            ],
        });

        expect(wrapper.find('input[placeholder="SKU"]').element.value).toBe('SKU-FROM-PARENT');
        expect(wrapper.find('input[placeholder="0.00"]').element.value).toBe('20');
    });

    it('removes a variant row when delete action is clicked', async () => {
        const wrapper = mount(ProductVariantTable, {
            props: {
                modelValue: [
                    ...baseVariants,
                    {
                        ...baseVariants[0],
                        id: 'v2',
                        sku: 'SKU-2',
                        options_values: { Color: 'Blue' },
                    },
                ],
            },
        });

        await wrapper.find('[data-testid="delete-variant-0"]').trigger('click');

        const updates = wrapper.emitted('update:modelValue');
        expect(updates).toBeTruthy();
        const lastPayload = updates[updates.length - 1][0];
        expect(lastPayload).toHaveLength(1);
        expect(lastPayload[0].id).toBe('v2');
    });

    it('renders incomplete variants as pending warning rows', () => {
        const wrapper = mount(ProductVariantTable, {
            props: {
                modelValue: [
                    {
                        ...baseVariants[0],
                        status: 'pending_incomplete',
                        options_values: { Color: 'Red' },
                    },
                ],
            },
        });

        expect(wrapper.find('[data-testid="variant-row-0"]').attributes('data-variant-state')).toBe('pending_incomplete');
        expect(wrapper.text()).toContain('Pending');
        expect(wrapper.text()).toContain('This legacy variant no longer matches the current spec structure.');
    });
});
