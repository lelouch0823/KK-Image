import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductImportModal from '../ProductImportModal.vue';

const mocks = vi.hoisted(() => ({
    importProducts: vi.fn(),
    addToast: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
    useProducts: () => ({
        importProducts: mocks.importProducts,
    }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (k) => k }),
}));

describe('ProductImportModal Variant-First Payload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.importProducts.mockResolvedValue({ success: true, count: 1 });
    });

    it('groups rows by spu and sends variant-first payload', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: {
                        template: '<div><slot></slot><slot name="footer"></slot></div>'
                    },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            {
                name: 'T恤',
                spu: 'SPU-1001',
                category: '上装',
                brand: 'KK',
                sku: 'SKU-RED',
                color: 'Red',
                price: 100
            },
            {
                name: 'T恤',
                spu: 'SPU-1001',
                category: '上装',
                brand: 'KK',
                sku: 'SKU-BLUE',
                color: 'Blue',
                price: 110
            },
            {
                name: '裤子',
                spu: '',
                sku: 'SKU-PANT',
                price: 200
            },
            {
                name: '帽子',
                spu: '',
                sku: 'SKU-HAT',
                price: 50
            }
        ];

        await wrapper.vm.handleImport();

        expect(mocks.importProducts).toHaveBeenCalledTimes(1);
        const payload = mocks.importProducts.mock.calls[0][0];
        
        expect(payload).toHaveLength(3);

        const spuProduct = payload.find(p => p.spu === 'SPU-1001');
        expect(spuProduct).toBeDefined();
        expect(spuProduct.name).toBe('T恤');
        expect(spuProduct.category).toBe('上装');
        expect(spuProduct.variants).toHaveLength(2);
        expect(spuProduct.variants[0].sku).toBe('SKU-RED');
        expect(spuProduct.variants[0].price).toBe(100);
        expect(spuProduct.variants[0].options_values).toEqual({ color: 'Red' });

        const emptySpuProducts = payload.filter(p => !p.spu);
        expect(emptySpuProducts).toHaveLength(2);
        expect(emptySpuProducts[0].variants).toHaveLength(1);
        expect(emptySpuProducts[1].variants).toHaveLength(1);
    });
});
