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

const sharedStubs = {
  Teleport: true,
  Transition: false,
  Modal: {
    template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
    props: ['modelValue', 'title', 'size', 'bodyClass'],
  },
  ActionBar: { template: '<div><slot name="leading" /><slot /></div>' },
  StatePanel: { template: '<section><slot /></section>' },
  AppButton: { template: '<button><slot /></button>' },
  AppCheckbox: { template: '<input type="checkbox" />' },
  StatusBadge: { template: '<div><slot /></div>' },
  AppIcon: { template: '<i />' },
  SearchInput: {
    props: ['modelValue'],
    template: '<input />',
  },
};

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
          ...sharedStubs,
          OrderWorkflowModal: {
            template: '<div data-testid="order-workflow" />',
            props: ['show', 'order', 'hydrating', 'hydrationError'],
          },
        },
      },
    });

    await wrapper.vm.viewOrder({ id: 'o-3', orderNo: 'SO-3' });

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(wrapper.find('[data-testid="order-workflow"]').exists()).toBe(true);
  });

  it('hides orders that are already in procurement when order progress data is available', async () => {
    mocks.orders.value = [
      {
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'confirmed',
        procurementStatus: 'none',
        productName: 'Available',
      },
      {
        id: 'o-2',
        orderNo: 'SO-2',
        status: 'confirmed',
        procurementStatus: 'ordered',
        productName: 'In Procurement',
      },
      {
        id: 'o-3',
        orderNo: 'SO-3',
        status: 'confirmed',
        displayStatus: 'partially_received',
        productName: 'Partially Received',
      },
    ];

    const wrapper = mount(OrderPickerModal, {
      props: {
        visible: true,
      },
      global: {
        stubs: {
          ...sharedStubs,
          OrderWorkflowModal: {
            template: '<div />',
            props: ['show', 'order', 'hydrating', 'hydrationError'],
          },
        },
      },
    });

    expect(wrapper.text()).toContain('SO-1');
    expect(wrapper.text()).not.toContain('SO-2');
    expect(wrapper.text()).not.toContain('SO-3');
  });

  it('keeps the latest order detail when earlier detail hydration resolves late', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.getOrder
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

    const wrapper = mount(OrderPickerModal, {
      props: {
        visible: true,
      },
      global: {
        stubs: {
          ...sharedStubs,
          OrderWorkflowModal: {
            template: '<div />',
            props: ['show', 'order', 'hydrating', 'hydrationError'],
          },
        },
      },
    });

    const firstPending = wrapper.vm.viewOrder({ id: 'o-1', orderNo: 'SO-1' });
    const secondPending = wrapper.vm.viewOrder({ id: 'o-2', orderNo: 'SO-2' });

    resolveSecond({ id: 'o-2', orderNo: 'SO-2', productName: 'Second' });
    await secondPending;

    expect(wrapper.vm.viewingOrder).toEqual(expect.objectContaining({ id: 'o-2' }));

    resolveFirst({ id: 'o-1', orderNo: 'SO-1', productName: 'First' });
    await firstPending;

    expect(wrapper.vm.viewingOrder).toEqual(expect.objectContaining({ id: 'o-2' }));
  });

  it('keeps previously selected orders when selecting all within a narrower search result', async () => {
    mocks.orders.value = [
      {
        id: 'order-a',
        orderNo: 'SO-A',
        status: 'confirmed',
        procurementStatus: 'none',
        productName: 'Alpha',
      },
      {
        id: 'order-b',
        orderNo: 'SO-B',
        status: 'confirmed',
        procurementStatus: 'none',
        productName: 'Beta',
      },
      {
        id: 'order-c',
        orderNo: 'SO-C',
        status: 'confirmed',
        procurementStatus: 'none',
        productName: 'Gamma',
      },
    ];

    const wrapper = mount(OrderPickerModal, {
      props: {
        visible: true,
      },
      global: {
        stubs: {
          ...sharedStubs,
          OrderWorkflowModal: {
            template: '<div />',
            props: ['show', 'order', 'hydrating', 'hydrationError'],
          },
        },
      },
    });

    wrapper.vm.toggleSelect(mocks.orders.value[0]);
    wrapper.vm.searchQuery = 'Beta';
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.filteredOrders.map((order) => order.id)).toEqual(['order-b']);

    wrapper.vm.toggleSelectAll();

    expect(wrapper.vm.selected.map((order) => order.id)).toEqual(['order-a', 'order-b']);
  });
});
