import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderEditModal from '@/components/OrderEditModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useSalesToken', () => ({
  useSalesToken: () => ({ token: { value: 'sales-token' } }),
}));

const baseOrder = {
  id: 'order-1',
  orderNo: 'SO-1001',
  status: 'pending',
  quantity: 7,
  productId: 'product-1',
  variantId: 'variant-1',
  salespersonId: 'sp-1',
  files: [],
  originalData: {},
  currentData: {
    name: '外套',
    brand: 'KK',
    series: 'Winter',
    sku: 'SKU-1001',
    size: 'L',
    color: '黑色',
    material: '棉',
    quantity: 1,
    remark: '',
    deadline: '',
  },
};

const buildStubs = (overrides = {}) => ({
  Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
  ProductBindingSection: {
    props: ['variantSelectPolicy'],
    template: '<div data-testid="variant-policy">{{ variantSelectPolicy }}</div>',
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
  ConfirmDialog: true,
  AppIcon: true,
  OrderFormFields: {
    props: ['boundProductVariant', 'modelValue'],
    template: `
      <div>
        <div data-testid="bound-variant">{{ JSON.stringify(boundProductVariant) }}</div>
        <div data-testid="form-quantity">{{ modelValue.quantity }}</div>
      </div>
    `,
  },
  ...overrides,
});

const mountModal = (order, stubs = {}) =>
  mount(OrderEditModal, {
    props: {
      order,
      submitting: false,
      mode: 'admin',
      salespersons: [{ id: 'sp-1', name: 'Alice', store: 'Main' }],
    },
    global: {
      stubs: buildStubs(stubs),
    },
  });

describe('OrderEditModal variant locking on edit', () => {
  it('uses in_stock_only policy by default for variant selector', () => {
    const wrapper = mountModal(baseOrder);
    expect(wrapper.get('[data-testid="variant-policy"]').text()).toBe('in_stock_only');
  });

  it('keeps bound variant specs in locked mode for existing bound orders', () => {
    const wrapper = mountModal(baseOrder);
    expect(wrapper.get('[data-testid="bound-variant"]').text()).not.toBe('null');
  });

  it('keeps unlocked mode when order is not bound to a variant', () => {
    const wrapper = mountModal({
      ...baseOrder,
      productId: null,
      variantId: null,
    });
    expect(wrapper.get('[data-testid="bound-variant"]').text()).toBe('null');
  });

  it('submits explicit null productId and variantId after unbind', async () => {
    const wrapper = mountModal(baseOrder, {
      ProductBindingSection: {
        template: '<button data-testid="unbind" @click="$emit(\'unbind\')">unbind</button>',
      },
      ConfirmDialog: {
        props: ['modelValue'],
        template:
          '<button v-if="modelValue" data-testid="confirm-save" @click="$emit(\'confirm\', \'reason\')">confirm</button>',
      },
    });

    await wrapper.get('[data-testid="unbind"]').trigger('click');

    const saveBtn = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('common.save'));
    expect(saveBtn).toBeTruthy();
    await saveBtn.trigger('click');
    await wrapper.get('[data-testid="confirm-save"]').trigger('click');

    const submitPayload = wrapper.emitted('submit')?.[0]?.[0];
    expect(submitPayload).toMatchObject({
      productId: null,
      variantId: null,
    });
  });

  it('prefers top-level order quantity over stale currentData quantity', () => {
    const wrapper = mountModal(baseOrder);
    expect(wrapper.get('[data-testid="form-quantity"]').text()).toBe('7');
  });
});
