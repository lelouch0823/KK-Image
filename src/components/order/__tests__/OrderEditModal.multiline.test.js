import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderEditModal from '@/components/OrderEditModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/useSalesToken', () => ({
  useSalesToken: () => ({ token: { value: 'sales-token' } }),
}));

const baseOrder = {
  id: 'order-1',
  orderNo: 'SO-1001',
  status: 'pending',
  quantity: 5,
  productId: null,
  variantId: null,
  salespersonId: 'sp-1',
  files: [],
  lines: [
    { id: 'line-1', snapshotName: 'Desk', orderedQuantity: 2, productId: 'product-1', variantId: 'variant-1' },
    { id: 'line-2', snapshotName: 'Chair', orderedQuantity: 3, productId: 'product-2', variantId: 'variant-2' },
  ],
  originalData: {},
  currentData: {
    remark: 'keep',
    deadline: '',
    lines: [
      {
        name: 'Desk',
        quantity: 2,
        sku: 'SKU-DESK',
        category: 'Tables',
        productId: 'product-1',
        variantId: 'variant-1',
        boundProduct: {
          id: 'product-1',
          name: 'Desk',
          sku: 'SKU-DESK',
          variantId: 'variant-1',
        },
        boundProductVariant: {
          Color: 'Oak',
        },
      },
      {
        name: 'Chair',
        quantity: 3,
        sku: 'SKU-CHAIR',
        category: 'Seating',
        productId: 'product-2',
        variantId: 'variant-2',
        boundProduct: {
          id: 'product-2',
          name: 'Chair',
          sku: 'SKU-CHAIR',
          variantId: 'variant-2',
        },
        boundProductVariant: {
          Color: 'Walnut',
        },
      },
    ],
  },
};

const singleLineManualOrder = {
  ...baseOrder,
  quantity: 1,
  lines: [{ id: 'line-1', snapshotName: 'Manual Item', orderedQuantity: 1 }],
  currentData: {
    remark: 'keep',
    deadline: '',
    lines: [{ name: 'Manual Item', quantity: 1, sku: 'SKU-MANUAL' }],
  },
};

const selectedProduct = {
  id: 'product-9',
  name: 'Bound Coat',
  brand: 'KK',
  series: 'Winter',
  mainImage: '/file/prefill-main-image',
  dimension_map: {},
  selectedVariant: {
    id: 'variant-9',
    sku: 'SKU-BOUND',
    options_values: {},
  },
};

const buildStubs = (overrides = {}) => ({
  Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
  ProductBindingSection: {
    template: '<div />',
  },
  OrderOriginalInfo: true,
  ImageUploader: {
    template: '<div />',
    methods: {
      async uploadPendingFiles() {
        return true;
      },
    },
  },
  OrderFormFields: {
    props: ['modelValue'],
    template: '<div data-testid="edit-form-state">{{ JSON.stringify(modelValue) }}</div>',
  },
  OrderLinesEditor: {
    props: ['modelValue'],
    template: '<div data-testid="line-state">{{ JSON.stringify(modelValue) }}</div>',
  },
  ConfirmDialog: {
    props: ['modelValue'],
    template:
      '<button v-if="modelValue" data-testid="confirm-save" @click="$emit(\'confirm\', \'reason\')">confirm</button>',
  },
  AppButton: {
    template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  AppIcon: true,
  ...overrides,
});

const mountModal = (order = baseOrder, stubs = {}, props = {}) =>
  mount(OrderEditModal, {
    props: {
      order,
      submitting: false,
      mode: 'admin',
      salespersons: [{ id: 'sp-1', name: 'Alice', store: 'Main' }],
      ...props,
    },
    global: {
      stubs: buildStubs(stubs),
    },
  });

const findSaveButton = (wrapper) =>
  wrapper
    .findAll('button')
    .find((btn) => btn.text().includes('common.save') || btn.text().includes('保存'));

describe('OrderEditModal multiline editing', () => {
  it('keeps existing line-level product bindings when initializing multiline editor state', () => {
    const wrapper = mountModal();
    const lineState = wrapper.get('[data-testid="line-state"]').text();

    expect(lineState).toContain('"productId":"product-1"');
    expect(lineState).toContain('"variantId":"variant-1"');
    expect(lineState).toContain('"boundProduct":{"id":"product-1"');
    expect(lineState).toContain('"boundProductVariant":{"Color":"Oak"}');
  });

  it('submits normalized lines and rolled-up quantity for multiline orders', async () => {
    const wrapper = mountModal(baseOrder, {
      OrderFormFields: {
        props: ['modelValue'],
        template: '<div data-testid="edit-form-remark">{{ modelValue.remark }}</div>',
      },
      OrderLinesEditor: {
        props: ['modelValue'],
        template: `
          <div>
            <div data-testid="multiline-count">{{ modelValue.length }}</div>
            <button
              data-testid="mutate-lines"
              @click="$emit('update:modelValue', [
                {
                  clientId: 'existing-line-1',
                  name: 'Desk Pro',
                  quantity: 2,
                  sku: 'SKU-DESK',
                  category: 'Tables',
                  productId: 'product-1',
                  variantId: 'variant-1',
                  boundProduct: {
                    id: 'product-1',
                    name: 'Desk',
                    sku: 'SKU-DESK',
                    variantId: 'variant-1',
                  },
                  boundProductVariant: {
                    Color: 'Oak',
                  },
                },
                {
                  clientId: 'existing-line-2',
                  name: 'Chair',
                  quantity: 4,
                  sku: 'SKU-CHAIR',
                  category: 'Seating',
                  productId: 'product-2',
                  variantId: 'variant-2',
                  boundProduct: {
                    id: 'product-2',
                    name: 'Chair',
                    sku: 'SKU-CHAIR',
                    variantId: 'variant-2',
                  },
                  boundProductVariant: {
                    Color: 'Walnut',
                  },
                },
              ])"
            >
              mutate
            </button>
          </div>
        `,
      },
    });

    expect(wrapper.get('[data-testid="multiline-count"]').text()).toBe('2');

    await wrapper.get('[data-testid="mutate-lines"]').trigger('click');

    const saveBtn = findSaveButton(wrapper);
    expect(saveBtn).toBeTruthy();
    await saveBtn.trigger('click');
    await wrapper.get('[data-testid="confirm-save"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload).toMatchObject({
      updates: {
        name: 'Desk Pro',
        sku: 'SKU-DESK',
        quantity: 6,
        lines: [
          expect.objectContaining({
            name: 'Desk Pro',
            quantity: 2,
            sku: 'SKU-DESK',
            category: 'Tables',
            productId: 'product-1',
            variantId: 'variant-1',
          }),
          expect.objectContaining({
            name: 'Chair',
            quantity: 4,
            sku: 'SKU-CHAIR',
            category: 'Seating',
            productId: 'product-2',
            variantId: 'variant-2',
          }),
        ],
      },
    });
  });

  it('does not expose multiline editing controls in sales mode even for multiline orders', () => {
    const wrapper = mountModal(baseOrder, {}, { mode: 'sales' });

    expect(wrapper.find('[data-testid="line-state"]').exists()).toBe(false);
    const buttonTexts = wrapper.findAll('button').map((btn) => btn.text());
    expect(buttonTexts).not.toContain('切回单行');
    expect(buttonTexts).not.toContain('启用多行');
  });

  it('does not render product binding controls for sales multiline orders', () => {
    const wrapper = mountModal(
      baseOrder,
      {
        ProductBindingSection: {
          template: '<div data-testid="binding-section" />',
        },
      },
      { mode: 'sales' }
    );

    expect(wrapper.find('[data-testid="binding-section"]').exists()).toBe(false);
  });

  it('passes sales mode and sales token through to product binding section', () => {
    const wrapper = mountModal(
      singleLineManualOrder,
      {
        ProductBindingSection: {
          props: ['mode', 'salesToken'],
          template: '<div data-testid="binding-props">{{ mode }}|{{ salesToken }}</div>',
        },
      },
      { mode: 'sales' }
    );

    expect(wrapper.get('[data-testid="binding-props"]').text()).toBe('sales|sales-token');
  });

  it('does not submit unchanged multiline lines when only remark changes', async () => {
    const wrapper = mountModal(baseOrder, {
      OrderFormFields: {
        props: ['modelValue'],
        template: `
          <div>
            <div data-testid="edit-form-remark">{{ modelValue.remark }}</div>
            <button
              data-testid="change-remark"
              @click="$emit('update:modelValue', { ...modelValue, remark: 'updated remark' })"
            >
              change remark
            </button>
          </div>
        `,
      },
    });

    await wrapper.get('[data-testid="change-remark"]').trigger('click');

    const saveBtn = findSaveButton(wrapper);
    expect(saveBtn).toBeTruthy();
    await saveBtn.trigger('click');
    await wrapper.get('[data-testid="confirm-save"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload?.updates).toMatchObject({
      remark: 'updated remark',
    });
    expect(payload?.updates?.lines).toBeUndefined();
  });

  it('submits explicit single bound line when collapsing a multiline order through product binding', async () => {
    const wrapper = mountModal(baseOrder, {
      ProductBindingSection: {
        template:
          '<button data-testid="select-product" @click="$emit(\'select\', selectedProduct)">select</button>',
        data() {
          return { selectedProduct };
        },
      },
    });

    await wrapper.get('[data-testid="select-product"]').trigger('click');

    const saveBtn = findSaveButton(wrapper);
    expect(saveBtn).toBeTruthy();
    await saveBtn.trigger('click');
    await wrapper.get('[data-testid="confirm-save"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload).toMatchObject({
      productId: 'product-9',
      variantId: 'variant-9',
      updates: {
        name: 'Bound Coat',
        brand: 'KK',
        series: 'Winter',
        sku: 'SKU-BOUND',
        quantity: 5,
        lines: [
          expect.objectContaining({
            name: 'Bound Coat',
            brand: 'KK',
            series: 'Winter',
            sku: 'SKU-BOUND',
            quantity: 5,
            productId: 'product-9',
            variantId: 'variant-9',
          }),
        ],
      },
    });
    expect(payload?.updates?.lines).toHaveLength(1);
  });

  it('does not submit generated prefill image ids as persisted fileIds', async () => {
    const wrapper = mountModal(singleLineManualOrder, {
      ProductBindingSection: {
        template:
          '<button data-testid="select-product" @click="$emit(\'select\', selectedProduct)">select</button>',
        data() {
          return { selectedProduct };
        },
      },
    });

    await wrapper.get('[data-testid="select-product"]').trigger('click');

    const saveBtn = findSaveButton(wrapper);
    expect(saveBtn).toBeTruthy();
    await saveBtn.trigger('click');
    await wrapper.get('[data-testid="confirm-save"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload).toMatchObject({
      productId: 'product-9',
      variantId: 'variant-9',
    });
    expect(payload?.fileIds).toBeUndefined();
  });
});
