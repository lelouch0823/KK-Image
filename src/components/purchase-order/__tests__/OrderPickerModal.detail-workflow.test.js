import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import OrderPickerModal from '../OrderPickerModal.vue';

const mocks = vi.hoisted(() => ({
  loadOrders: vi.fn(),
  getOrder: vi.fn(),
  addComment: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    loadOrders: mocks.loadOrders,
    orders: ref([]),
    loading: ref(false),
    getOrder: mocks.getOrder,
    addComment: mocks.addComment,
  }),
}));

describe('OrderPickerModal detail workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadOrders.mockResolvedValue();
    mocks.addComment.mockResolvedValue(true);
  });

  it('keeps detail shell open when detail hydration fails', async () => {
    mocks.getOrder.mockResolvedValue(null);

    const wrapper = mount(OrderPickerModal, {
      props: {
        visible: true,
      },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          Modal: { template: '<div><slot name="header" /><slot /></div>', props: ['modelValue', 'title', 'size', 'bodyClass'] },
          OrderWorkflowModal: { template: '<div data-testid="order-workflow" />', props: ['show', 'order', 'hydrating', 'hydrationError'] },
          AppIcon: { template: '<i />' },
        },
      },
    });

    await wrapper.vm.viewOrder({ id: 'o-3', orderNo: 'SO-3' });

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(wrapper.find('[data-testid="order-workflow"]').exists()).toBe(true);
  });
});
