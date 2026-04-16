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

const readBlobText = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
  reader.readAsText(blob);
});

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

    await wrapper.find('[data-testid="export-scope-filtered"]').trigger('click');
    await wrapper.find('[data-testid="export-generate"]').trigger('click');
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
    await wrapper.find('[data-testid="export-generate"]').trigger('click');
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

  it('keeps filtered export rows aligned with current variant-level filters', async () => {
    mocks.listProductsForExport.mockResolvedValue({
      success: true,
      data: [{ id: 'p-1', name: 'Lite Product' }],
    });
    mocks.loadProduct.mockResolvedValue({
      id: 'p-1',
      name: 'Full Product',
      variants: [
        { id: 'v-1', sku: 'SKU-1', status: 'active', available_quantity: 5 },
        { id: 'v-archived', sku: 'SKU-ARCHIVED', status: 'archived', available_quantity: 5 },
        { id: 'v-oos', sku: 'SKU-OOS', status: 'active', available_quantity: 0 },
      ],
    });

    const wrapper = mount(ProductExportModal, {
      props: {
        modelValue: true,
        filters: { status: 'active', hasStock: 'in_stock' },
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

    wrapper.vm.form.scope = 'filtered';
    wrapper.vm.form.format = 'csv';
    await wrapper.find('[data-testid="export-generate"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.vm.readyToDownload).toBe(true);
    vi.useRealTimers();
    const csv = await readBlobText(wrapper.vm.generatedBlob);
    expect(csv).toContain('SKU-1');
    expect(csv).not.toContain('SKU-ARCHIVED');
    expect(csv).not.toContain('SKU-OOS');
  });

  it('fails export when a product detail cannot be hydrated', async () => {
    mocks.listProductsForExport.mockResolvedValue({
      success: true,
      data: [{ id: 'p-1', name: 'Lite Product' }],
    });
    mocks.loadProduct.mockResolvedValue(null);

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
    await wrapper.find('[data-testid="export-generate"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.vm.readyToDownload).toBe(false);
    expect(wrapper.vm.generatedBlob).toBe(null);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  });

  it('resets export options after the modal closes', async () => {
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
    wrapper.vm.form.scope = 'filtered';

    await wrapper.setProps({ modelValue: false });
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ modelValue: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.form.format).toBe('excel');
    expect(wrapper.vm.form.scope).toBe('all');
  });

  it('invalidates a ready download when the export format changes', async () => {
    mocks.listProductsForExport.mockResolvedValue({
      success: true,
      data: [{ id: 'p-1', name: 'Lite Product' }],
    });
    mocks.loadProduct.mockResolvedValue({
      id: 'p-1',
      name: 'Full Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });

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

    wrapper.vm.form.format = 'excel';
    await wrapper.find('[data-testid="export-generate"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.vm.readyToDownload).toBe(true);
    expect(wrapper.vm.generatedBlob).not.toBe(null);

    wrapper.vm.form.format = 'csv';
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.readyToDownload).toBe(false);
    expect(wrapper.vm.generatedBlob).toBe(null);
  });

  it('invalidates a ready download when filtered export inputs change', async () => {
    mocks.listProductsForExport.mockResolvedValue({
      success: true,
      data: [{ id: 'p-1', name: 'Lite Product' }],
    });
    mocks.loadProduct.mockResolvedValue({
      id: 'p-1',
      name: 'Full Product',
      variants: [{ id: 'v-1', sku: 'SKU-1' }],
    });

    const wrapper = mount(ProductExportModal, {
      props: {
        modelValue: true,
        filters: { search: 'desk', status: 'active' },
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

    wrapper.vm.form.scope = 'filtered';
    await wrapper.find('[data-testid="export-generate"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.vm.readyToDownload).toBe(true);

    await wrapper.setProps({
      filters: { search: 'chair', status: 'active' },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.readyToDownload).toBe(false);
    expect(wrapper.vm.generatedBlob).toBe(null);
  });
});
