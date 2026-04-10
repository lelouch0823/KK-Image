import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import OrderPickerModal from '../OrderPickerModal.vue';

const mocks = vi.hoisted(() => ({
  loadOrders: vi.fn(),
  getOrder: vi.fn(),
  addComment: vi.fn(),
  orders: { value: [] },
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    loadOrders: mocks.loadOrders,
    orders: mocks.orders,
    loading: ref(false),
    getOrder: mocks.getOrder,
    addComment: mocks.addComment,
  }),
}));

describe('OrderPickerModal detail workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orders.value = [];
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

  it('hides orders that are already in procurement when order progress data is available', async () => {
    mocks.orders.value = [
      { id: 'o-1', orderNo: 'SO-1', status: 'confirmed', procurementStatus: 'none', productName: 'Available' },
      { id: 'o-2', orderNo: 'SO-2', status: 'confirmed', procurementStatus: 'ordered', productName: 'In Procurement' },
      { id: 'o-3', orderNo: 'SO-3', status: 'confirmed', displayStatus: 'partially_received', productName: 'Partially Received' },
    ];

    const wrapper = mount(OrderPickerModal, {
      props: {
        visible: true,
      },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          OrderWorkflowModal: { template: '<div />', props: ['show', 'order', 'hydrating', 'hydrationError'] },
          AppIcon: { template: '<i />' },
          SearchInput: {
            props: ['modelValue'],
            template: '<input />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('SO-1');
    expect(wrapper.text()).not.toContain('SO-2');
    expect(wrapper.text()).not.toContain('SO-3');
  });
});
