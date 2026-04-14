import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, reactive } from 'vue';
import OrderManager from '../OrderManager.vue';

const mocks = vi.hoisted(() => ({
  loadOrders: vi.fn(),
  getOrder: vi.fn(),
  updateOrder: vi.fn(),
  reserveOrderLine: vi.fn(),
  releaseOrderLine: vi.fn(),
  shipOrderLine: vi.fn(),
  unshipOrderLine: vi.fn(),
  returnOrderLine: vi.fn(),
  confirmOrderDelivery: vi.fn(),
  changeStatus: vi.fn(),
  addComment: vi.fn(),
  batchAction: vi.fn(),
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  routeQuery: {},
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    orders: ref([]),
    salespersons: ref([]),
    statuses: ref(['pending', 'confirmed']),
    procurementStatuses: ref([]),
    loading: ref(false),
    error: ref(''),
    errorCode: ref(''),
    pagination: reactive({ page: 1, total: 0, totalPages: 1 }),
    loadOrders: mocks.loadOrders,
    getOrder: mocks.getOrder,
    updateOrder: mocks.updateOrder,
    reserveOrderLine: mocks.reserveOrderLine,
    releaseOrderLine: mocks.releaseOrderLine,
    shipOrderLine: mocks.shipOrderLine,
    unshipOrderLine: mocks.unshipOrderLine,
    returnOrderLine: mocks.returnOrderLine,
    confirmOrderDelivery: mocks.confirmOrderDelivery,
    changeStatus: mocks.changeStatus,
    addComment: mocks.addComment,
    batchAction: mocks.batchAction,
  }),
}));

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => ({}),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({
    subscribeModule: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, payloadOrFallback) => {
      const payload = payloadOrFallback && typeof payloadOrFallback === 'object'
        ? payloadOrFallback
        : null;

      if (key === 'order.detail.shipConfirmMessage') {
        return payload
          ? `确认对订单行 ${payload.lineLabel} 出货 ${payload.quantity} 件吗？`
          : '确认对当前订单行执行出货操作。';
      }
      if (key === 'order.detail.unshipConfirmMessage') {
        return payload
          ? `确认对订单行 ${payload.lineLabel} 撤销出货 ${payload.quantity} 件吗？`
          : '确认对当前订单行执行撤销出货操作。';
      }
      if (key === 'order.detail.returnConfirmMessage') {
        return payload
          ? `确认对订单行 ${payload.lineLabel} 退回 ${payload.quantity} 件吗？`
          : '确认对当前订单行执行退回操作。';
      }

      return typeof payloadOrFallback === 'string' ? payloadOrFallback : key;
    },
  }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: vi.fn() }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetch: vi.fn(),
    currentUser: ref({ permissions: [] }),
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
}));

describe('OrderManager network workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }))
    );
    mocks.routeQuery = {};
    mocks.loadOrders.mockResolvedValue();
    mocks.getOrder.mockResolvedValue(null);
    mocks.updateOrder.mockResolvedValue(true);
    mocks.reserveOrderLine.mockResolvedValue(true);
    mocks.releaseOrderLine.mockResolvedValue(true);
    mocks.shipOrderLine.mockResolvedValue(true);
    mocks.unshipOrderLine.mockResolvedValue(true);
    mocks.returnOrderLine.mockResolvedValue(true);
    mocks.confirmOrderDelivery.mockResolvedValue(true);
    mocks.changeStatus.mockResolvedValue(true);
    mocks.addComment.mockResolvedValue(true);
    mocks.batchAction.mockResolvedValue(true);
  });

  function createWrapper() {
    return mount(OrderManager, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="content" /><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          Modal: { template: '<div><slot name="header" /><slot /></div>', props: ['modelValue', 'title', 'size'] },
          OrderDashboard: { template: '<div />' },
          OrderTable: { template: '<div />' },
          OrderFilters: { template: '<div />' },
          OrderListStatusStack: { template: '<div />' },
          Pagination: { template: '<div />' },
          OrderCards: { template: '<div />' },
          AppIcon: { template: '<i />' },
          OrderCreateModal: { template: '<div v-if="modelValue" data-testid="order-create-modal" />', props: ['modelValue'] },
          OrderEditModal: { template: '<div />' },
          OrderWorkflowModal: {
            template: '<div data-testid="order-workflow"><button data-testid="confirm-delivery-trigger" @click="$emit(\'confirm-delivery\', { note: \'signed by receiver\' })">confirm delivery</button><button data-testid="return-trigger" @click="$emit(\'line-command\', { action: \'return\', lineId: \'line-1\', quantity: 1 })">return</button></div>',
            props: ['show', 'order'],
          },
          ConfirmDialog: {
            template: '<button v-if="modelValue" data-testid="confirm-dialog-button" @click="$emit(\'confirm\')">confirm</button>',
            props: ['modelValue', 'title', 'message', 'type', 'loading'],
          },
          OrderReturnDialog: {
            template: '<button v-if="modelValue" data-testid="return-dialog-confirm" @click="$emit(\'confirm\', { reason: \'damage\', note: \'box crushed\' })">return confirm</button>',
            props: ['modelValue', 'quantity', 'lineLabel', 'loading'],
          },
          DestructiveConfirmModal: { template: '<div />' },
        },
      },
    });
  }

  it('opens detail shell immediately with preview data before hydrating order', async () => {
    let resolveOrder;
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        })
    );

    const wrapper = createWrapper();
    const pending = wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(wrapper.vm.viewingOrder).toEqual({ id: 'o-1', orderNo: 'SO-1' });
    expect(wrapper.find('[data-testid="order-workflow"]').exists()).toBe(true);

    resolveOrder({ id: 'o-1', orderNo: 'SO-1', currentData: { name: 'Hydrated' } });
    await pending;
  });

  it('does not let stale detail hydration overwrite a newer order context', async () => {
    const resolvers = [];
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    const wrapper = createWrapper();
    const firstPending = wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });
    const secondPending = wrapper.vm.openDetailModal({ id: 'o-2', orderNo: 'SO-2' });

    expect(wrapper.vm.viewingOrder).toEqual({ id: 'o-2', orderNo: 'SO-2' });

    resolvers[1]({ id: 'o-2', orderNo: 'SO-2', currentData: { name: 'Newer Order' } });
    await secondPending;

    expect(wrapper.vm.viewingOrder).toMatchObject({
      id: 'o-2',
      currentData: { name: 'Newer Order' },
    });

    resolvers[0]({ id: 'o-1', orderNo: 'SO-1', currentData: { name: 'Older Order' } });
    await firstPending;

    expect(wrapper.vm.viewingOrder).toMatchObject({
      id: 'o-2',
      currentData: { name: 'Newer Order' },
    });
  });

  it('keeps query-driven detail shell open and preserves query on hydration failure', async () => {
    mocks.routeQuery = { id: 'o-query' };
    mocks.getOrder.mockResolvedValue(null);

    const wrapper = createWrapper();
    await vi.waitFor(() => {
      expect(wrapper.vm.showDetailModal).toBe(true);
    });

    expect(wrapper.vm.viewingOrder).toEqual({ id: 'o-query' });
    expect(wrapper.find('[data-testid="order-workflow"]').exists()).toBe(true);
    expect(mocks.routerReplace).not.toHaveBeenCalled();
  });

  it('clears query only after the user closes the detail shell', async () => {
    mocks.routeQuery = { id: 'o-close' };
    mocks.getOrder.mockResolvedValue({ id: 'o-close', orderNo: 'SO-CLOSE' });

    const wrapper = createWrapper();
    await vi.waitFor(() => {
      expect(wrapper.vm.showDetailModal).toBe(true);
    });

    wrapper.vm.showDetailModal = false;
    await wrapper.vm.$nextTick();

    expect(mocks.routerReplace).toHaveBeenCalledWith({ query: {} });
  });

  it('hydrates full order before opening edit from detail', async () => {
    let resolveOrder;
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        })
    );

    const wrapper = createWrapper();
    const pending = wrapper.vm.handleEditFromDetail({ id: 'o-edit', orderNo: 'SO-EDIT' });

    expect(mocks.getOrder).toHaveBeenCalledWith('o-edit');
    expect(wrapper.vm.showEditModal).toBe(false);
    expect(wrapper.vm.editingOrder).toBe(null);

    resolveOrder({ id: 'o-edit', orderNo: 'SO-EDIT', currentData: { name: 'Hydrated Order' } });
    await pending;

    expect(wrapper.vm.showEditModal).toBe(true);
    expect(wrapper.vm.editingOrder.currentData.name).toBe('Hydrated Order');
  });

  it('does not let stale edit hydration overwrite the latest edit target', async () => {
    const resolvers = [];
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    const wrapper = createWrapper();
    const firstPending = wrapper.vm.openEditModal({ id: 'o-1', orderNo: 'SO-1' });
    const secondPending = wrapper.vm.openEditModal({ id: 'o-2', orderNo: 'SO-2' });

    resolvers[1]({ id: 'o-2', orderNo: 'SO-2', currentData: { name: 'Second Order' } });
    await secondPending;

    expect(wrapper.vm.showEditModal).toBe(true);
    expect(wrapper.vm.editingOrder).toMatchObject({
      id: 'o-2',
      currentData: { name: 'Second Order' },
    });

    resolvers[0]({ id: 'o-1', orderNo: 'SO-1', currentData: { name: 'First Order' } });
    await firstPending;

    expect(wrapper.vm.editingOrder).toMatchObject({
      id: 'o-2',
      currentData: { name: 'Second Order' },
    });
  });

  it('opens create modal when toggled from the manager', async () => {
    const wrapper = createWrapper();

    wrapper.vm.showCreateModal = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="order-create-modal"]').exists()).toBe(true);
  });

  it('opens confirmation before submitting line commands and refreshes detail after confirm', async () => {
    mocks.getOrder
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        lines: [{ id: 'line-1', variantId: 'var-1', shippedQuantity: 0 }],
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        lines: [{ id: 'line-1', variantId: 'var-1', shippedQuantity: 2 }],
      });

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    const opened = await wrapper.vm.handleOrderLineCommand({ lineId: 'line-1', action: 'ship', quantity: 2 });

    expect(opened).toBe(true);
    expect(wrapper.vm.lineCommandConfirm.show).toBe(true);
    expect(mocks.shipOrderLine).not.toHaveBeenCalled();

    await wrapper.vm.confirmLineCommand();
    expect(mocks.shipOrderLine).toHaveBeenCalledWith('o-1', 'line-1', 2);
    expect(mocks.getOrder).toHaveBeenLastCalledWith('o-1');
    expect(mocks.loadOrders).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.viewingOrder.lines[0].shippedQuantity).toBe(2);
  });

  it('keeps the workflow modal open while line command retries are in flight', async () => {
    let resolveFirstAttempt;
    mocks.getOrder.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      lines: [{ id: 'line-1', variantId: 'var-1', reservedQuantity: 0 }],
    });
    mocks.reserveOrderLine.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirstAttempt = resolve;
        })
    );

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    await wrapper.vm.handleOrderLineCommand({ lineId: 'line-1', action: 'reserve', quantity: 1 });
    const firstAttempt = wrapper.vm.confirmLineCommand();

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(wrapper.vm.lineCommandState.pending).toBe(true);

    resolveFirstAttempt(false);
    await firstAttempt;

    expect(wrapper.vm.showDetailModal).toBe(true);

    mocks.reserveOrderLine.mockResolvedValue(true);
    await wrapper.vm.handleOrderLineCommand({ lineId: 'line-1', action: 'reserve', quantity: 1 });
    await wrapper.vm.confirmLineCommand();

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(mocks.reserveOrderLine).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending line command confirmation without executing the action', async () => {
    mocks.getOrder.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      lines: [{ id: 'line-1', variantId: 'var-1', shippedQuantity: 2 }],
    });

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    await wrapper.vm.handleOrderLineCommand({ lineId: 'line-1', action: 'unship', quantity: 1 });

    expect(wrapper.vm.lineCommandConfirm.show).toBe(true);

    wrapper.vm.cancelLineCommandConfirm();

    expect(wrapper.vm.lineCommandConfirm.show).toBe(false);
    expect(mocks.unshipOrderLine).not.toHaveBeenCalled();
  });

  it('builds localized line command confirmation copy with the selected quantity and line label', async () => {
    mocks.getOrder.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      lines: [{ id: 'line-1', variantId: 'var-1', snapshotName: '测试款', shippedQuantity: 0 }],
    });

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    const opened = await wrapper.vm.handleOrderLineCommand({
      lineId: 'line-1',
      action: 'ship',
      quantity: 3,
    });

    expect(opened).toBe(true);
    expect(wrapper.vm.lineCommandConfirm.message).toBe('确认对订单行 测试款 出货 3 件吗？');
  });

  it('does not submit fulfillment commands for lines without a variant binding', async () => {
    mocks.getOrder.mockResolvedValue({
      id: 'o-1',
      orderNo: 'SO-1',
      lines: [{ id: 'line-1', variantId: null, reservedQuantity: 0 }],
    });

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    const result = await wrapper.vm.handleOrderLineCommand({
      lineId: 'line-1',
      action: 'reserve',
      quantity: 1,
    });

    expect(result).toBe(false);
    expect(mocks.reserveOrderLine).not.toHaveBeenCalled();
    expect(wrapper.vm.lineCommandState.error).toBe(
      'Bind a product variant before using fulfillment actions.'
    );
  });

  it('confirms delivery through the management dialog and refreshes detail state', async () => {
    mocks.getOrder
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'fulfilled',
        deliveryStatus: 'in_transit',
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'fulfilled',
        deliveryStatus: 'delivered',
        deliveryConfirmedBy: 'Admin',
      });

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    await wrapper.get('[data-testid="confirm-delivery-trigger"]').trigger('click');
    await wrapper.get('[data-testid="confirm-dialog-button"]').trigger('click');

    expect(mocks.confirmOrderDelivery).toHaveBeenCalledWith('o-1', 'signed by receiver');
    expect(mocks.getOrder).toHaveBeenCalledTimes(2);
  });

  it('collects structured return metadata before executing the return action', async () => {
    mocks.getOrder
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'fulfilled',
        deliveryStatus: 'delivered',
        lines: [{ id: 'line-1', snapshotName: 'Chair', variantId: 'var-1' }],
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        orderNo: 'SO-1',
        status: 'fulfilled',
        deliveryStatus: 'partially_returned',
        lines: [{ id: 'line-1', snapshotName: 'Chair', variantId: 'var-1', returnedQuantity: 1 }],
      });

    const wrapper = createWrapper();
    await wrapper.vm.openDetailModal({ id: 'o-1', orderNo: 'SO-1' });

    await wrapper.get('[data-testid="return-trigger"]').trigger('click');
    await wrapper.get('[data-testid="return-dialog-confirm"]').trigger('click');

    expect(mocks.returnOrderLine).toHaveBeenCalledWith('o-1', 'line-1', {
      quantity: 1,
      reason: 'damage',
      note: 'box crushed',
    });
  });
});
