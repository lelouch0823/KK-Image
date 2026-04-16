import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ProductPickerModal from '../ProductPickerModal.vue';

const mocks = vi.hoisted(() => ({
  loadActiveVariants: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    loadActiveVariants: mocks.loadActiveVariants,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn) => fn,
}));

describe('ProductPickerModal lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = (props = {}) =>
    mount(ProductPickerModal, {
      props: {
        visible: false,
        existingBrands: [],
        initialSelectedVariantIds: [],
        ...props,
      },
      global: {
        stubs: {
          Teleport: true,
          Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
          ActionBar: { template: '<div><slot name="leading" /><slot /></div>' },
          StatePanel: { template: '<section><slot /></section>' },
          AppButton: { template: '<button><slot /></button>' },
          AppCheckbox: { template: '<input type="checkbox" />' },
          StatusBadge: { template: '<div><slot /></div>' },
          SearchInput: true,
          AppIcon: true,
          AppImage: true,
        },
      },
    });

  it('keeps the latest search results when earlier searches resolve late', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.loadActiveVariants
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const wrapper = createWrapper();
    await wrapper.setProps({ visible: true });
    await wrapper.vm.$nextTick();

    wrapper.vm.searchQuery = 'chair';
    const secondPending = wrapper.vm.loadVariants();
    await Promise.resolve();

    resolveSecond({
      items: [{ variant_id: 'variant-chair', product_name: 'Chair', variant_options: {} }],
    });
    await secondPending;

    expect(wrapper.vm.variants).toEqual([expect.objectContaining({ variant_id: 'variant-chair' })]);

    resolveFirst({
      items: [{ variant_id: 'variant-desk', product_name: 'Desk', variant_options: {} }],
    });
    await flushPromises();

    expect(wrapper.vm.variants).toEqual([expect.objectContaining({ variant_id: 'variant-chair' })]);
  });

  it('keeps the latest reopen results when an earlier open resolves late', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.loadActiveVariants
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const wrapper = createWrapper();
    await wrapper.setProps({ visible: true });
    await wrapper.vm.$nextTick();

    await wrapper.setProps({ visible: false });
    await wrapper.setProps({ visible: true });
    await wrapper.vm.$nextTick();

    resolveSecond({
      items: [{ variant_id: 'variant-new', product_name: 'New', variant_options: {} }],
    });
    await flushPromises();

    expect(wrapper.vm.variants).toEqual([expect.objectContaining({ variant_id: 'variant-new' })]);

    resolveFirst({
      items: [{ variant_id: 'variant-old', product_name: 'Old', variant_options: {} }],
    });
    await flushPromises();

    expect(wrapper.vm.variants).toEqual([expect.objectContaining({ variant_id: 'variant-new' })]);
  });

  it('preserves selected variant payloads across search result changes before confirm', async () => {
    mocks.loadActiveVariants
      .mockResolvedValueOnce({
        items: [
          {
            variant_id: 'variant-a',
            product_id: 'prod-a',
            product_name: 'Alpha',
            sku: 'SKU-A',
            unit_cost: 10,
            variant_options: {},
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            variant_id: 'variant-b',
            product_id: 'prod-b',
            product_name: 'Beta',
            sku: 'SKU-B',
            unit_cost: 12,
            variant_options: {},
          },
        ],
      });

    const wrapper = createWrapper();
    await wrapper.setProps({ visible: true });
    await flushPromises();

    wrapper.vm.toggleSelect(wrapper.vm.variants[0]);

    wrapper.vm.searchQuery = 'beta';
    await wrapper.vm.loadVariants();
    await flushPromises();

    wrapper.vm.toggleSelect(wrapper.vm.variants[0]);
    wrapper.vm.confirm();

    expect(wrapper.emitted('confirm')).toEqual([
      [
        expect.objectContaining({
          selectedVariantIds: ['variant-a', 'variant-b'],
          selectedVariants: [
            expect.objectContaining({ variant_id: 'variant-a', product_id: 'prod-a' }),
            expect.objectContaining({ variant_id: 'variant-b', product_id: 'prod-b' }),
          ],
        }),
      ],
    ]);
  });
});
