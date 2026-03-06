import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesFormView from '@/views/sales/SalesFormView.vue';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createSalesOrder: vi.fn(),
  addToast: vi.fn(),
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
          prefillData: ref({ name: 'Existing Product' }),
          setPrefillData: vi.fn(),
          loadOrders: vi.fn(),
          salesOrderMode: ref('refactor'),
        },
      },
      stubs: {
        ProductBindingSection: {
          props: ['variantSelectPolicy'],
          template: `
            <div>
              <span data-testid="variant-policy">{{ variantSelectPolicy }}</span>
              <button data-testid="trigger-product-error" @click="$emit('product-fetch-error', 'fetch failed')">error</button>
            </div>
          `,
        },
        OrderForm: {
          props: ['submitError'],
          template: `
            <div>
              <button data-testid="submit-order" @click="$emit('submit', { name: 'Existing Product', fileIds: ['f-1'] })">submit</button>
              <p v-if="submitError" data-testid="submit-error">{{ submitError }}</p>
            </div>
          `,
        },
      },
    },
  });

describe('SalesFormView resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows inline product-fetch error with retry action', async () => {
    mocks.createSalesOrder.mockResolvedValue(true);
    const wrapper = mountView();
    expect(wrapper.get('[data-testid="variant-policy"]').text()).toBe('in_stock_only');

    await wrapper.get('[data-testid="trigger-product-error"]').trigger('click');

    expect(wrapper.find('[data-testid="product-fetch-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="product-fetch-retry"]').exists()).toBe(true);
  });

  it('prevents silent submit failure and keeps form state', async () => {
    mocks.createSalesOrder.mockResolvedValue(false);
    const wrapper = mountView();

    await wrapper.get('[data-testid="submit-order"]').trigger('click');

    expect(wrapper.find('[data-testid="submit-error"]').exists()).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.createSalesOrder).toHaveBeenCalledWith(
      'sales-token',
      expect.objectContaining({ name: 'Existing Product', fileIds: ['f-1'] }),
      expect.any(Function)
    );
  });
});
