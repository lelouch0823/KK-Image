import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductBindingSection from '../ProductBindingSection.vue';

const mocks = vi.hoisted(() => ({
  loadProduct: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (k) => k }),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    loadProduct: mocks.loadProduct,
  }),
}));

const pickStub = {
  template: '<button data-testid="pick-product" @click="$emit(\'select\', { id: \'p1\' })">pick</button>',
};

describe('ProductBindingSection variant status and dimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 3D selectors and disables non-orderable options', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Tee',
      variants: [
        { id: 'v1', sku: 'Y-C-S', status: 'active', stock_quantity: 10, alert_threshold: 3, options_values: { color: 'Yellow', material: 'Cotton', size: 'S' } },
        { id: 'v2', sku: 'Y-C-M', status: 'active', stock_quantity: 0, alert_threshold: 3, options_values: { color: 'Yellow', material: 'Cotton', size: 'M' } },
        { id: 'v3', sku: 'Y-S-S', status: 'archived', stock_quantity: 9, alert_threshold: 3, options_values: { color: 'Yellow', material: 'Silk', size: 'S' } },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null },
      global: {
        stubs: {
          ProductSelect: pickStub,
          AppImage: true,
        },
      },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());
    const selected = wrapper.emitted('select')[0][0];
    await wrapper.setProps({
      boundProduct: {
        id: selected.id,
        name: selected.name,
        sku: selected.selectedVariant?.sku || '',
        mainImage: selected.mainImage || null,
      },
    });

    expect(wrapper.find('[data-testid="dimension-color"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-material"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-size"]').exists()).toBe(true);

    const sizeButtons = wrapper.findAll('[data-testid="dimension-size"]');
    const mButton = sizeButtons.find((btn) => btn.text() === 'M');
    expect(mButton).toBeTruthy();
    expect(mButton.find('input').element.disabled).toBe(true);
  });

  it('adapts to 2D variants (no material)', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Pants',
      variants: [
        { id: 'v1', sku: 'B-S', status: 'active', stock_quantity: 4, alert_threshold: 1, options_values: { color: 'Black', size: 'S' } },
        { id: 'v2', sku: 'B-M', status: 'active', stock_quantity: 6, alert_threshold: 1, options_values: { color: 'Black', size: 'M' } },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());
    const selected = wrapper.emitted('select')[0][0];
    await wrapper.setProps({
      boundProduct: {
        id: selected.id,
        name: selected.name,
        sku: selected.selectedVariant?.sku || '',
        mainImage: selected.mainImage || null,
      },
    });

    expect(wrapper.find('[data-testid="dimension-color"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-size"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-material"]').exists()).toBe(false);
  });

  it('adapts to 1D variants', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Fabric',
      variants: [
        { id: 'v1', sku: 'COT', status: 'active', stock_quantity: 8, alert_threshold: 2, options_values: { material: 'Cotton' } },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());
    const selected = wrapper.emitted('select')[0][0];
    await wrapper.setProps({
      boundProduct: {
        id: selected.id,
        name: selected.name,
        sku: selected.selectedVariant?.sku || '',
        mainImage: selected.mainImage || null,
      },
    });

    expect(wrapper.find('[data-testid="dimension-material"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-color"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dimension-size"]').exists()).toBe(false);
  });

  it('supports dynamic dimension ids and renders more than three dimensions', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Jacket',
      dimension_map: {
        'dim-color': '颜色',
        'dim-size': '尺码',
        'dim-fit': '版型',
        'dim-season': '季节',
      },
      dimensions: [
        { id: 'dim-color', name: '颜色' },
        { id: 'dim-size', name: '尺码' },
        { id: 'dim-fit', name: '版型' },
        { id: 'dim-season', name: '季节' },
      ],
      variants: [
        {
          id: 'v1',
          sku: 'JK-RED-M-SL-SS',
          status: 'active',
          stock_quantity: 8,
          alert_threshold: 2,
          options_values: {
            'dim-color': 'Red',
            'dim-size': 'M',
            'dim-fit': 'Slim',
            'dim-season': 'SS',
          },
        },
        {
          id: 'v2',
          sku: 'JK-RED-L-RG-AW',
          status: 'active',
          stock_quantity: 5,
          alert_threshold: 2,
          options_values: {
            'dim-color': 'Red',
            'dim-size': 'L',
            'dim-fit': 'Regular',
            'dim-season': 'AW',
          },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());
    const selected = wrapper.emitted('select')[0][0];
    await wrapper.setProps({
      boundProduct: {
        id: selected.id,
        name: selected.name,
        sku: selected.selectedVariant?.sku || '',
        mainImage: selected.mainImage || null,
      },
    });

    expect(wrapper.find('[data-testid="dimension-dim-color"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-dim-size"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-dim-fit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-dim-season"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('颜色');
    expect(wrapper.text()).toContain('尺码');
    expect(wrapper.text()).toContain('版型');
    expect(wrapper.text()).toContain('季节');
  });
});
