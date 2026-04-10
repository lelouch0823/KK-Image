import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ProductExportModal from '../ProductExportModal.vue';

const mocks = vi.hoisted(() => ({
  listProductsForExport: vi.fn(),
  loadProduct: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    listProductsForExport: mocks.listProductsForExport,
    loadProduct: mocks.loadProduct,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('ProductExportModal filter forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProductsForExport.mockResolvedValue({ success: true, data: [] });
    vi.useFakeTimers();
  });

  it('passes all current filters when generating filtered export', async () => {
    const wrapper = mount(ProductExportModal, {
      props: {
        modelValue: true,
        filters: {
          search: 'desk',
          status: 'active',
          brand: 'ACME',
          category: 'Furniture',
          hasStock: 'in_stock',
          sortBy: 'stock',
          sortOrder: 'asc',
        },
      },
      global: {
        stubs: {
          Modal: {
            props: ['modelValue', 'title', 'size'],
            template: '<div><slot /><slot name="footer" /></div>',
          },
          AppIcon: true,
        },
      },
    });

    await wrapper.find('input[value="filtered"]').setValue(true);
    await wrapper.find('button.btn.btn-primary').trigger('click');
    await vi.advanceTimersByTimeAsync(150);

    expect(mocks.listProductsForExport).toHaveBeenCalledWith({
      search: 'desk',
      status: 'active',
      brand: 'ACME',
      category: 'Furniture',
      hasStock: 'in_stock',
      sortBy: 'stock',
      sortOrder: 'asc',
      page: 1,
      limit: 100,
    });
  });

  it('discards pending export results after modal closes', async () => {
    let resolveDetail;
    mocks.listProductsForExport.mockResolvedValue({
      success: true,
      data: [{ id: 'p-1', name: 'Lite Product' }],
    });
    mocks.loadProduct.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        })
    );

    const wrapper = mount(ProductExportModal, {
      props: {
        modelValue: true,
        filters: {},
      },
      global: {
        stubs: {
          Modal: {
            props: ['modelValue', 'title', 'size'],
            template: '<div><slot /><slot name="footer" /></div>',
          },
          AppIcon: true,
        },
      },
    });

    wrapper.vm.form.format = 'csv';
    await wrapper.find('button.btn.btn-primary').trigger('click');
    await vi.advanceTimersByTimeAsync(150);

    expect(wrapper.vm.isGenerating).toBe(true);

    await wrapper.setProps({ modelValue: false });
    await wrapper.vm.$nextTick();

    resolveDetail({
      id: 'p-1',
      name: 'Full Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.vm.readyToDownload).toBe(false);
    expect(wrapper.vm.generatedBlob).toBe(null);
  });
});
