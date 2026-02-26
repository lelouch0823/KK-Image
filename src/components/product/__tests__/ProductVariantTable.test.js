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
});

