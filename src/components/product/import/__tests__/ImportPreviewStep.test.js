import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ImportPreviewStep from '../ImportPreviewStep.vue';

const mocks = vi.hoisted(() => ({
    copy: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (k, _fallback) => k })
}));

vi.mock('@/composables/useClipboard', () => ({
    useClipboard: () => ({
        copy: mocks.copy,
    }),
}));

describe('ImportPreviewStep', () => {
    const createWrapper = (parsedItems = []) => {
        return mount(ImportPreviewStep, {
            props: {
                fileName: 'test.xlsx',
                fileSize: '10KB',
                parsedItems,
                loading: false,
                importResult: null,
                importError: null,
                importStats: {},
                preprocessStats: {},
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });
    };

    it('shows warning when duplicated spu is detected', async () => {
        const wrapper = createWrapper([
            { name: 'Item A', spu: 'SPU-1' },
            { name: 'Item B', spu: 'SPU-1' }
        ]);

        expect(wrapper.text()).toContain('product.import.spu_update_warning');
    });

    it('does not show warning when there is no duplicated spu', async () => {
        const wrapper = createWrapper([
            { name: 'Item A', spu: 'SPU-1' },
            { name: 'Item B', spu: '' }
        ]);

        expect(wrapper.text()).not.toContain('product.import.spu_update_warning');
    });

    it('renders import summary stats when summary payload is provided', async () => {
        const wrapper = mount(ImportPreviewStep, {
            props: {
                fileName: 'test.xlsx',
                fileSize: '10KB',
                parsedItems: [{ name: 'Item A', spu: 'SPU-1' }],
                loading: false,
                importResult: {
                    success: true,
                    count: 2,
                    failed: 0,
                    summary: {
                        createdProducts: 1,
                        updatedProducts: 1,
                        createdVariants: 1,
                        updatedVariants: 1,
                    },
                },
                importError: null,
                importStats: {},
                preprocessStats: {},
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });

        expect(wrapper.text()).toContain('product.import.stats.created_products');
        expect(wrapper.text()).toContain('product.import.stats.updated_products');
        expect(wrapper.text()).toContain('product.import.stats.created_variants');
        expect(wrapper.text()).toContain('product.import.stats.updated_variants');
    });

    it('renders preprocess stats before import', async () => {
        const wrapper = mount(ImportPreviewStep, {
            props: {
                fileName: 'test.xlsx',
                fileSize: '10KB',
                parsedItems: [{ name: 'Item A', sku: 'SKU-1' }],
                loading: false,
                importResult: null,
                importError: null,
                importStats: {},
                preprocessStats: {
                    sourceRows: 12,
                    acceptedRows: 10,
                    droppedEmptyRows: 2,
                    normalizedRows: 6,
                },
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });

        expect(wrapper.text()).toContain('product.import.preprocess.source_rows');
        expect(wrapper.text()).toContain('product.import.preprocess.accepted_rows');
        expect(wrapper.text()).toContain('product.import.preprocess.dropped_rows');
        expect(wrapper.text()).toContain('product.import.preprocess.normalized_rows');
        expect(wrapper.text()).toContain('12');
        expect(wrapper.text()).toContain('10');
    });

    it('renders conflict section when conflict payload exists', async () => {
        const wrapper = mount(ImportPreviewStep, {
            props: {
                fileName: 'test.xlsx',
                fileSize: '10KB',
                parsedItems: [{ name: 'Item A', sku: 'SKU-1' }],
                loading: false,
                importResult: {
                    success: true,
                    count: 1,
                    failed: 0,
                    summary: { conflicts: 1 },
                    conflicts: [
                        {
                            batch: 1,
                            level: 'variant',
                            spu: 'SPU-1',
                            sku: 'SKU-1',
                            field: 'price',
                            current: 100,
                            incoming: 120,
                        },
                    ],
                },
                importError: null,
                importStats: {},
                preprocessStats: {},
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });

        expect(wrapper.text()).toContain('product.import.conflicts.title');
        expect(wrapper.text()).toContain('SPU-1');
        expect(wrapper.text()).toContain('price');
    });

    it('supports conflict filtering and searching controls', async () => {
        const wrapper = mount(ImportPreviewStep, {
            props: {
                fileName: 'test.xlsx',
                fileSize: '10KB',
                parsedItems: [{ name: 'Item A', sku: 'SKU-1' }],
                loading: false,
                importResult: {
                    success: true,
                    count: 1,
                    failed: 0,
                    summary: { conflicts: 2 },
                    conflicts: [
                        { level: 'product', spu: 'SPU-P', sku: '', field: 'name', current: 'A', incoming: 'B' },
                        { level: 'variant', spu: 'SPU-V', sku: 'SKU-V', field: 'price', current: 100, incoming: 120 },
                    ],
                },
                importError: null,
                importStats: {},
                preprocessStats: {},
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });

        wrapper.getComponent('[data-testid="conflict-level-select"]').vm.$emit('update:modelValue', 'variant');
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('SKU-V');
        expect(wrapper.text()).not.toContain('SPU-P');

        const input = wrapper.get('[data-testid="conflict-search-input"]');
        await input.setValue('price');
        expect(wrapper.text()).toContain('price');
        await input.setValue('not-found-keyword');
        expect(wrapper.text()).toContain('product.import.conflicts.empty_filtered');
    });

    it('copies visible conflicts through the shared clipboard helper', async () => {
        const wrapper = mount(ImportPreviewStep, {
            props: {
                fileName: 'test.xlsx',
                fileSize: '10KB',
                parsedItems: [{ name: 'Item A', sku: 'SKU-1' }],
                loading: false,
                importResult: {
                    success: true,
                    count: 1,
                    failed: 0,
                    summary: { conflicts: 1 },
                    conflicts: [
                        {
                            batch: 1,
                            level: 'variant',
                            spu: 'SPU-1',
                            sku: 'SKU-1',
                            field: 'price',
                            current: 100,
                            incoming: 120,
                        },
                    ],
                },
                importError: null,
                importStats: {},
                preprocessStats: {},
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });

        await wrapper.get('[data-testid="copy-visible-conflicts"]').trigger('click');

        expect(mocks.copy).toHaveBeenCalledWith(
            '[variant] SPU=SPU-1 SKU=SKU-1 price: 100 -> 120',
            expect.any(Object)
        );
    });
});
