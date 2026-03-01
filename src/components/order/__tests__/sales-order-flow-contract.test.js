import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesFormView from '@/views/sales/SalesFormView.vue';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createSalesOrder: vi.fn(),
  addToast: vi.fn(),
  loadOrders: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
  useRoute: () => ({ params: { token: 'sales-token' } }),
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    createSalesOrder: mocks.createSalesOrder,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

const mountView = () =>
  mount(SalesFormView, {
    global: {
      provide: {
        salesContext: {
          prefillData: ref(null),
          setPrefillData: vi.fn(),
          loadOrders: mocks.loadOrders,
        },
      },
      stubs: {
        ProductBindingSection: {
          template: `
            <div>
              <button data-testid="select-bound" @click="$emit('select', {
                id: 'p-100',
                name: 'Sneaker',
                brand: 'Brand',
                series: 'S1',
                selectedVariant: { id: 'v-200', sku: 'SKU-1', options_values: { color: 'Black', size: '42' } }
              })">select</button>
              <button data-testid="unbind-product" @click="$emit('unbind')">unbind</button>
            </div>
          `,
        },
        OrderForm: {
          template: `
            <div>
              <button data-testid="submit-bound" @click="$emit('submit', { name: 'Bound', quantity: 1, fileIds: ['f-1'] })">submit-bound</button>
              <button data-testid="submit-unbound" @click="$emit('submit', { name: 'Unbound', quantity: 1, fileIds: ['f-2'] })">submit-unbound</button>
            </div>
          `,
        },
      },
    },
  });

describe('sales order flow contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSalesOrder.mockResolvedValue(true);
  });

  it('keeps create payload structure for bound/unbound product modes', async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="select-bound"]').trigger('click');
    await wrapper.get('[data-testid="submit-bound"]').trigger('click');

    expect(mocks.createSalesOrder).toHaveBeenNthCalledWith(
      1,
      'sales-token',
      expect.objectContaining({
        name: 'Bound',
        quantity: 1,
        productId: 'p-100',
        variantId: 'v-200',
        fileIds: ['f-1'],
      }),
      expect.any(Function),
    );

    await wrapper.get('[data-testid="unbind-product"]').trigger('click');
    await wrapper.get('[data-testid="submit-unbound"]').trigger('click');

    const secondPayload = mocks.createSalesOrder.mock.calls[1][1];
    expect(secondPayload).toEqual({
      name: 'Unbound',
      quantity: 1,
      fileIds: ['f-2'],
    });
    expect(secondPayload).not.toHaveProperty('productId');
    expect(secondPayload).not.toHaveProperty('variantId');
  });
});
