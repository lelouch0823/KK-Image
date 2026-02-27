import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ImportPreviewStep from '../ImportPreviewStep.vue';

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (k, _fallback) => k })
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
                chunkSize: 200
            },
            global: {
                stubs: { AppIcon: true }
            }
        });
    };

    it('shows warning when the parsed items contain spu', async () => {
        const wrapper = createWrapper([
            { name: 'Item A', spu: 'SPU-1' }
        ]);

        expect(wrapper.text()).toContain('product.import.spu_update_warning');
    });

    it('does not show warning when no spu is provided', async () => {
        const wrapper = createWrapper([
            { name: 'Item B', spu: '' }
        ]);

        expect(wrapper.text()).not.toContain('product.import.spu_update_warning');
    });
});
