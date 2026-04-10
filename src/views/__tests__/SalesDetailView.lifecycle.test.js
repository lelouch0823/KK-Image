import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import SalesDetailView from '../sales/SalesDetailView.vue';

const routeState = reactive({
  params: {
    token: 'sales-token',
    id: 'order-1',
  },
});

const mocks = vi.hoisted(() => ({
  getSalesOrder: vi.fn(),
  addSalesComment: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    getSalesOrder: mocks.getSalesOrder,
    addSalesComment: mocks.addSalesComment,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: mocks.routerPush }),
}));

const createWrapper = () =>
  mount(SalesDetailView, {
    global: {
      provide: {
        salesContext: {
          loadOrders: vi.fn(),
          setPrefillData: vi.fn(),
          salesOrderMode: { value: 'legacy' },
        },
      },
      stubs: {
        'router-link': true,
        OrderDetail: {
          props: ['order'],
          template: '<div data-testid="order-detail">{{ order?.id }}</div>',
        },
        EmptyState: true,
        AsyncStatePanel: {
          props: ['description'],
          template: '<div data-testid="async-error">{{ description }}</div>',
        },
      },
    },
  });

describe('SalesDetailView lifecycle', () => {
  const wrappers = [];

  afterEach(() => {
    while (wrappers.length > 0) {
      wrappers.pop()?.unmount();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    routeState.params.token = 'sales-token';
    routeState.params.id = 'order-1';
    mocks.addSalesComment.mockResolvedValue(true);
  });

  it('reloads detail when route order id changes on the same view instance', async () => {
    mocks.getSalesOrder
      .mockResolvedValueOnce({ id: 'order-1' })
      .mockResolvedValueOnce({ id: 'order-2' });

    const wrapper = createWrapper();
    wrappers.push(wrapper);
    await flushPromises();

    expect(wrapper.get('[data-testid="order-detail"]').text()).toBe('order-1');

    routeState.params.id = 'order-2';
    await nextTick();
    await flushPromises();

    expect(mocks.getSalesOrder).toHaveBeenNthCalledWith(1, 'sales-token', 'order-1');
    expect(mocks.getSalesOrder).toHaveBeenNthCalledWith(2, 'sales-token', 'order-2');
    expect(wrapper.get('[data-testid="order-detail"]').text()).toBe('order-2');
  });

  it('does not let stale detail requests overwrite the latest route context', async () => {
    const resolvers = [];
    mocks.getSalesOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    const wrapper = createWrapper();
    wrappers.push(wrapper);
    await nextTick();

    routeState.params.id = 'order-2';
    await nextTick();

    expect(mocks.getSalesOrder).toHaveBeenCalledTimes(2);

    resolvers[1]({ id: 'order-2' });
    await flushPromises();

    expect(wrapper.get('[data-testid="order-detail"]').text()).toBe('order-2');

    resolvers[0]({ id: 'order-1' });
    await flushPromises();

    expect(wrapper.get('[data-testid="order-detail"]').text()).toBe('order-2');
  });
});
