import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductBindingSection from '../ProductBindingSection.vue';

const mocks = vi.hoisted(() => ({
  loadProduct: vi.fn(),
  loadSalesProduct: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (k) => k }),
}));

vi.mock('@/composables/useProducts', () => ({
  useProducts: () => ({
    loadProduct: mocks.loadProduct,
  }),
}));

vi.mock('@/composables/useSalesProducts', () => ({
  useSalesProducts: () => ({
    loadSalesProduct: mocks.loadSalesProduct,
  }),
}));

const pickStub = {
  template:
    '<button data-testid="pick-product" @click="$emit(\'select\', { id: \'p1\' })">pick</button>',
};

const salesPickStub = {
  template:
    '<button data-testid="pick-sales-product" @click="$emit(\'select\', { id: \'p1\' })">pick-sales</button>',
};

describe('ProductBindingSection variant status and dimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates an existing bound product without auto-emitting a reselection', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Existing Tee',
      variants: [
        {
          id: 'v1',
          sku: 'TEE-S',
          status: 'active',
          stock_quantity: 8,
          alert_threshold: 3,
          options_values: { color: 'Black', size: 'S' },
        },
        {
          id: 'v2',
          sku: 'TEE-M',
          status: 'active',
          available_quantity: 2,
          stock_quantity: 9,
          alert_threshold: 3,
          options_values: { color: 'Black', size: 'M' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: {
        boundProduct: {
          id: 'p1',
          name: 'Existing Tee',
          sku: 'TEE-M',
          variantId: 'v2',
          mainImage: null,
        },
        mode: 'admin',
      },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await vi.waitFor(() => expect(mocks.loadProduct).toHaveBeenCalledWith('p1'));

    expect(wrapper.find('[data-testid="dimension-size"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="inventory-summary"]').text()).toContain('2');
    expect(wrapper.emitted('select')).toBeFalsy();
  });

  it('renders 3D selectors and disables archived options', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Tee',
      variants: [
        {
          id: 'v1',
          sku: 'Y-C-S',
          status: 'active',
          stock_quantity: 10,
          alert_threshold: 3,
          options_values: { color: 'Yellow', material: 'Cotton', size: 'S' },
        },
        {
          id: 'v2',
          sku: 'Y-C-M',
          status: 'active',
          stock_quantity: 0,
          alert_threshold: 3,
          options_values: { color: 'Yellow', material: 'Cotton', size: 'M' },
        },
        {
          id: 'v3',
          sku: 'Y-S-S',
          status: 'archived',
          stock_quantity: 9,
          alert_threshold: 3,
          options_values: { color: 'Yellow', material: 'Silk', size: 'S' },
        },
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

    const materialButtons = wrapper.findAll('[data-testid="dimension-material"]');
    const silkButton = materialButtons.find((btn) => btn.text() === 'Silk');
    expect(silkButton).toBeTruthy();
    expect(silkButton.find('input').element.disabled).toBe(true);
  });

  it('keeps the latest product detail when selections race', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.loadProduct
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

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    const first = wrapper.vm.handleProductSelect({ id: 'p1' });
    const second = wrapper.vm.handleProductSelect({ id: 'p2' });

    resolveSecond({
      id: 'p2',
      name: 'Second Product',
      variants: [
        {
          id: 'v2',
          sku: 'SKU-2',
          status: 'active',
          stock_quantity: 8,
          alert_threshold: 2,
          options_values: { color: 'Blue' },
        },
      ],
    });
    await second;

    resolveFirst({
      id: 'p1',
      name: 'Stale Product',
      variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          status: 'active',
          stock_quantity: 8,
          alert_threshold: 2,
          options_values: { color: 'Red' },
        },
      ],
    });
    await first;

    const emitted = wrapper.emitted('select') || [];
    expect(emitted.at(-1)?.[0]?.id).toBe('p2');
    expect(wrapper.vm.fullProductData.id).toBe('p2');
  });

  it('adapts to 2D variants (no material)', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Pants',
      variants: [
        {
          id: 'v1',
          sku: 'B-S',
          status: 'active',
          stock_quantity: 4,
          alert_threshold: 1,
          options_values: { color: 'Black', size: 'S' },
        },
        {
          id: 'v2',
          sku: 'B-M',
          status: 'active',
          stock_quantity: 6,
          alert_threshold: 1,
          options_values: { color: 'Black', size: 'M' },
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

    expect(wrapper.find('[data-testid="dimension-color"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-size"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dimension-material"]').exists()).toBe(false);
  });

  it('adapts to 1D variants', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Fabric',
      variants: [
        {
          id: 'v1',
          sku: 'COT',
          status: 'active',
          stock_quantity: 8,
          alert_threshold: 2,
          options_values: { material: 'Cotton' },
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

  it('does not fallback to product image when selected variant has no image (strict mode)', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Strict Tee',
      images: ['img-product-level'],
      variants: [
        {
          id: 'v1',
          sku: 'STRICT-1',
          status: 'active',
          stock_quantity: 5,
          alert_threshold: 1,
          options_values: { color: 'Black' },
          images: [],
          image_id: null,
          primaryImage: null,
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
    expect(selected.selectedVariant?.id).toBe('v1');
    expect(selected.mainImage).toBeNull();
  });

  it('allows selecting active out-of-stock variant in admin mode', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Preorder Sneaker',
      variants: [
        {
          id: 'v1',
          sku: 'PRE-001',
          status: 'active',
          stock_quantity: 0,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin' },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());

    const selected = wrapper.emitted('select')[0][0];
    expect(selected.selectedVariant?.id).toBe('v1');
  });

  it('allows selecting active out-of-stock variant in sales mode', async () => {
    mocks.loadSalesProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Sales Preorder Sneaker',
      variants: [
        {
          id: 'v1',
          sku: 'PRE-SALES-001',
          status: 'active',
          stock_quantity: 0,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'sales', salesToken: 'token-1' },
      global: { stubs: { ProductSelect: salesPickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-sales-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());

    const selected = wrapper.emitted('select')[0][0];
    expect(selected.selectedVariant?.id).toBe('v1');
  });

  it('allows selecting out-of-stock variant when legacy status is numeric active flag', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Legacy Status Product',
      variants: [
        {
          id: 'v1',
          sku: 'LEG-001',
          status: 1,
          stock_quantity: 0,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin' },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());

    const selected = wrapper.emitted('select')[0][0];
    expect(selected.selectedVariant?.id).toBe('v1');
  });

  it('supports in_stock_only policy and disables out-of-stock options', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Policy Product',
      variants: [
        {
          id: 'v1',
          sku: 'POL-001',
          status: 'active',
          stock_quantity: 0,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '42' },
        },
        {
          id: 'v2',
          sku: 'POL-002',
          status: 'active',
          stock_quantity: 8,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '43' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin', variantSelectPolicy: 'in_stock_only' },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());

    const selectedEvents = wrapper.emitted('select');
    const selected = selectedEvents[0][0];
    expect(selected.selectedVariant?.id).toBe('v2');

    await wrapper.vm.selectDimensionOption('size', '42');
    const afterSelectEvents = wrapper.emitted('select');
    expect(afterSelectEvents).toHaveLength(1);
  });

  it('emits fetch error instead of false success when sales product has no selectable variants', async () => {
    mocks.loadSalesProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Sold Out Product',
      variants: [
        {
          id: 'v1',
          sku: 'SOLD-OUT-1',
          status: 'active',
          stock_quantity: 0,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'sales', salesToken: 'token-1', variantSelectPolicy: 'in_stock_only' },
      global: { stubs: { ProductSelect: salesPickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-sales-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('product-fetch-error')).toBeTruthy());

    expect(wrapper.emitted('select')).toBeFalsy();
    expect(wrapper.emitted('product-fetch-success')).toBeFalsy();
    expect(wrapper.emitted('product-fetch-error')[0][0]).toBe('order.binding.variantRequired');
  });

  it('supports all policy and allows selecting archived variants', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'All Policy Product',
      variants: [
        {
          id: 'v1',
          sku: 'POL-ALL-001',
          status: 'archived',
          stock_quantity: 0,
          alert_threshold: 5,
          options_values: { color: 'Black', size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin', variantSelectPolicy: 'all' },
      global: { stubs: { ProductSelect: pickStub, AppImage: true } },
    });

    await wrapper.find('[data-testid="pick-product"]').trigger('click');
    await vi.waitFor(() => expect(wrapper.emitted('select')).toBeTruthy());

    const selected = wrapper.emitted('select')[0][0];
    expect(selected.selectedVariant?.id).toBe('v1');
  });

  it('clamps long texts for product and option labels to keep layout stable', async () => {
    const longName = '超长商品名称'.repeat(12);
    const longSku = 'SKU-LONG-'.repeat(8);
    const longOption = '超长规格值'.repeat(10);

    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: longName,
      variants: [
        {
          id: 'v1',
          sku: longSku,
          status: 'active',
          stock_quantity: 6,
          alert_threshold: 2,
          options_values: { size: longOption },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin' },
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

    const titleNode = wrapper.find(`h2[title="${longName}"]`);
    expect(titleNode.exists()).toBe(true);
    expect(titleNode.text().includes('…')).toBe(true);

    const optionNode = wrapper.find(`span[title="${longOption}"]`);
    expect(optionNode.exists()).toBe(true);
    expect(optionNode.text().includes('…')).toBe(true);
  });

  it('uses compact mobile layout tokens and touch-safe actions for bound products', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Mobile Compact Tee',
      variants: [
        {
          id: 'v1',
          sku: 'MOBILE-001',
          status: 'active',
          stock_quantity: 6,
          alert_threshold: 2,
          replenishment_quantity: 9,
          replenishment_po_count: 1,
          options_values: { color: 'Black', size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin' },
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

    expect(wrapper.find('[data-testid="binding-header"]').classes()).toEqual(
      expect.arrayContaining(['px-3', 'py-2.5', 'sm:px-5', 'sm:py-3.5'])
    );
    expect(wrapper.find('[data-testid="bound-image-shell"]').classes()).toEqual(
      expect.arrayContaining(['size-14', 'sm:size-20'])
    );
    expect(wrapper.find('[data-testid="inventory-summary"]').classes()).toEqual(
      expect.arrayContaining(['p-3', 'sm:p-4'])
    );
    expect(wrapper.find('[data-testid="unbind-product"]').classes()).toEqual(
      expect.arrayContaining(['min-h-11', 'min-w-11', 'inline-flex'])
    );
    expect(wrapper.find('[data-testid="dimension-options-size"]').classes()).toEqual(
      expect.arrayContaining(['gap-2'])
    );
  });

  it('uses refined meta and summary tokens in the compact mobile card', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Polished Compact Tee',
      variants: [
        {
          id: 'v1',
          sku: 'POLISH-001',
          status: 'active',
          stock_quantity: 12,
          alert_threshold: 2,
          replenishment_quantity: 3,
          replenishment_po_count: 2,
          options_values: { size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin' },
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

    expect(wrapper.find('[data-testid="bound-sku"]').classes()).toEqual(
      expect.arrayContaining(['bg-(--bg-muted)/45', 'border-(--border-subtle)/80'])
    );
    expect(wrapper.find('[data-testid="availability-badge"]').classes()).toEqual(
      expect.arrayContaining(['border', 'border-current/10'])
    );
    expect(wrapper.find('[data-testid="inventory-stats"]').classes()).toEqual(
      expect.arrayContaining(['divide-x', 'divide-(--border-subtle)/60'])
    );
    expect(wrapper.find('[data-testid="dimension-option-card-size"]').classes()).toEqual(
      expect.arrayContaining(['bg-(--bg-muted)/20'])
    );
  });

  it('uses available inventory semantics when variant exposes available_quantity', async () => {
    mocks.loadProduct.mockResolvedValueOnce({
      id: 'p1',
      name: 'Projection Product',
      variants: [
        {
          id: 'v1',
          sku: 'PROJ-001',
          status: 'active',
          stock_quantity: 10,
          available_quantity: 3,
          alert_threshold: 2,
          replenishment_quantity: 0,
          replenishment_po_count: 0,
          options_values: { size: '42' },
        },
      ],
    });

    const wrapper = mount(ProductBindingSection, {
      props: { boundProduct: null, mode: 'admin', variantSelectPolicy: 'in_stock_only' },
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

    expect(wrapper.find('[data-testid="inventory-summary"]').text()).toContain('3');
  });
});
