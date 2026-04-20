import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import Sales from '../Sales.vue';

const routeState = reactive({
  params: { token: 'sales-token-a' },
  path: '/sales/sales-token-a',
  fullPath: '/sales/sales-token-a',
});

const mocks = vi.hoisted(() => ({
  checkSalesAuth: vi.fn(),
  loginSales: vi.fn(),
  loadSalesOrders: vi.fn(),
  createSalesOrder: vi.fn(),
  getSalesOrder: vi.fn(),
  addSalesComment: vi.fn(),
  setSalesMode: vi.fn(),
  startNotificationPolling: vi.fn(),
  stopNotificationPolling: vi.fn(),
  requestPermission: vi.fn(),
  showOrderFeedbackNotification: vi.fn(),
  subscribeModule: vi.fn(() => vi.fn()),
  routerPush: vi.fn(),
  stateMachineLoadOrders: vi.fn(async () => ({ ok: true, data: { orders: [] } })),
  stateMachineRetry: vi.fn(),
  capturedStateMachineActions: null,
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    salesLoading: ref(false),
    salesOrders: ref([]),
    checkSalesAuth: mocks.checkSalesAuth,
    loginSales: mocks.loginSales,
    loadSalesOrders: mocks.loadSalesOrders,
    createSalesOrder: mocks.createSalesOrder,
    getSalesOrder: mocks.getSalesOrder,
    addSalesComment: mocks.addSalesComment,
    salesPagination: reactive({ page: 1, totalPages: 1, total: 0 }),
  }),
}));

vi.mock('@/composables/usePushNotification', () => ({
  usePushNotification: () => ({
    requestPermission: mocks.requestPermission,
    showOrderFeedbackNotification: mocks.showOrderFeedbackNotification,
  }),
}));

vi.mock('@/composables/sales/useSalesOrderStateMachine', () => ({
  useSalesOrderStateMachine: (actions) => {
    mocks.capturedStateMachineActions = actions;
    return {
      loadOrders: mocks.stateMachineLoadOrders,
      retry: mocks.stateMachineRetry,
      error: ref(''),
    };
  },
}));

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: ref(0),
    setSalesMode: mocks.setSalesMode,
    startPolling: mocks.startNotificationPolling,
    stopPolling: mocks.stopNotificationPolling,
  }),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({
    subscribeModule: mocks.subscribeModule,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/config/feature-flags', () => ({
  resolveSalesOrderEntry: () => 'legacy',
  isSalesOrderV2Enabled: () => false,
}));

vi.mock('@vueuse/core', () => ({
  onClickOutside: vi.fn(),
}));

describe('Sales notification mode lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capturedStateMachineActions = null;
    routeState.params.token = 'sales-token-a';
    routeState.path = '/sales/sales-token-a';
    routeState.fullPath = '/sales/sales-token-a';
    mocks.checkSalesAuth.mockResolvedValue({ id: 'sp-1', name: 'Alice' });
  });

  it('switches notifications to the latest sales token when route token changes', async () => {
    const wrapper = mount(Sales, {
      global: {
        stubs: {
          OrderLogin: true,
          SalesNotificationList: true,
          AppErrorBoundary: { template: '<div><slot /></div>' },
          AsyncStatePanel: true,
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: true,
          MobileSalesShell: { template: '<div><slot /></div>' },
          'router-view': true,
          'router-link': true,
        },
      },
    });

    await flushPromises();

    expect(mocks.setSalesMode).toHaveBeenCalledWith('sales-token-a');
    expect(mocks.startNotificationPolling).toHaveBeenCalledTimes(1);

    routeState.params.token = 'sales-token-b';
    routeState.path = '/sales/sales-token-b';
    routeState.fullPath = '/sales/sales-token-b';

    await flushPromises();

    expect(mocks.setSalesMode).toHaveBeenLastCalledWith('sales-token-b');
    expect(mocks.startNotificationPolling).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('does not let stale auth results overwrite the latest sales token context', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.checkSalesAuth
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

    const wrapper = mount(Sales, {
      global: {
        stubs: {
          OrderLogin: true,
          SalesNotificationList: true,
          AppErrorBoundary: { template: '<div><slot /></div>' },
          AsyncStatePanel: true,
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: true,
          MobileSalesShell: { template: '<div><slot /></div>' },
          'router-view': true,
          'router-link': true,
        },
      },
    });

    routeState.params.token = 'sales-token-b';
    routeState.path = '/sales/sales-token-b';
    routeState.fullPath = '/sales/sales-token-b';
    await flushPromises();

    resolveSecond({ id: 'sp-b', name: 'Bob' });
    await flushPromises();

    expect(wrapper.text()).toContain('Bob');

    resolveFirst({ id: 'sp-a', name: 'Alice' });
    await flushPromises();

    expect(wrapper.text()).toContain('Bob');
    expect(wrapper.text()).not.toContain('Alice');

    wrapper.unmount();
  });

  it('keeps createOrder compatible with legacy boolean success results', async () => {
    mocks.createSalesOrder.mockResolvedValue(true);

    mount(Sales, {
      global: {
        stubs: {
          OrderLogin: true,
          SalesNotificationList: true,
          AppErrorBoundary: { template: '<div><slot /></div>' },
          AsyncStatePanel: true,
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: true,
          MobileSalesShell: { template: '<div><slot /></div>' },
          'router-view': true,
          'router-link': true,
        },
      },
    });

    await flushPromises();

    const result = await mocks.capturedStateMachineActions.createOrder({ name: 'Desk', quantity: 1 });

    expect(result).toEqual({ ok: true, data: null });
  });
});
