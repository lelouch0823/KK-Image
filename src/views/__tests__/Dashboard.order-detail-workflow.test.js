import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import Dashboard from '../Dashboard.vue';

const mocks = vi.hoisted(() => ({
  authFetchJson: vi.fn(),
  getOrder: vi.fn(),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetchJson: mocks.authFetchJson,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    getOrder: mocks.getOrder,
    addComment: vi.fn(),
  }),
}));

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyShareLink: vi.fn() }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: vi.fn() }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('chart.js/auto', () => ({
  default: vi.fn(() => ({ destroy: vi.fn(), update: vi.fn(), data: { datasets: [{ data: [] }] } })),
}));

describe('Dashboard order detail workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetchJson.mockResolvedValue({
      success: true,
      data: {
        todayCount: 0,
        pendingCount: 0,
        weekCount: 0,
        lastWeekCount: 0,
        activeSharesCount: 0,
        recentPendingOrders: [],
      },
    });
  });

  function createWrapper() {
    return mount(Dashboard, {
      global: {
        stubs: {
          ShareManagementModal: { template: '<div />' },
          ShareFolderModal: { template: '<div />' },
          OrderWorkflowModal: { template: '<div data-testid="order-workflow" />', props: ['show', 'order'] },
          ConfirmDialog: { template: '<div />' },
          PermissionDeniedState: { template: '<div />' },
          AppImage: { template: '<div />' },
          AppButton: { template: '<button><slot /><slot name="append" /></button>' },
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });
  }

  it('opens order detail shell immediately before hydrating full order', async () => {
    let resolveOrder;
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        })
    );

    const wrapper = createWrapper();
    const pending = wrapper.vm.viewOrder({ id: 'o-2', orderNo: 'SO-2' });

    expect(wrapper.vm.showDetailModal).toBe(true);
    expect(wrapper.vm.viewingOrder).toEqual({ id: 'o-2', orderNo: 'SO-2' });

    resolveOrder({ id: 'o-2', orderNo: 'SO-2', currentData: { name: 'Hydrated' } });
    await pending;
  });

  it('does not let stale dashboard detail hydration overwrite a newer order context', async () => {
    const resolvers = [];
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    const wrapper = createWrapper();
    const firstPending = wrapper.vm.viewOrder({ id: 'o-1', orderNo: 'SO-1' });
    const secondPending = wrapper.vm.viewOrder({ id: 'o-2', orderNo: 'SO-2' });

    resolvers[1]({ id: 'o-2', orderNo: 'SO-2', currentData: { name: 'Newer Dashboard Order' } });
    await secondPending;

    expect(wrapper.vm.viewingOrder).toMatchObject({
      id: 'o-2',
      currentData: { name: 'Newer Dashboard Order' },
    });

    resolvers[0]({ id: 'o-1', orderNo: 'SO-1', currentData: { name: 'Older Dashboard Order' } });
    await firstPending;

    expect(wrapper.vm.viewingOrder).toMatchObject({
      id: 'o-2',
      currentData: { name: 'Newer Dashboard Order' },
    });
  });

  it('does not write back dashboard detail after the modal closes', async () => {
    let resolveOrder;
    mocks.getOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        })
    );

    const wrapper = createWrapper();
    const pending = wrapper.vm.viewOrder({ id: 'o-3', orderNo: 'SO-3' });

    wrapper.vm.closeDetailModal();

    resolveOrder({ id: 'o-3', orderNo: 'SO-3', currentData: { name: 'Late Detail' } });
    await pending;

    expect(wrapper.vm.showDetailModal).toBe(false);
    expect(wrapper.vm.viewingOrder).toBe(null);
  });

  it('links pending orders card to the named admin orders route', () => {
    const wrapper = createWrapper();

    expect(wrapper.get('a').attributes('data-to')).toBe(JSON.stringify({
      name: 'Orders',
      query: { status: 'pending' },
    }));
  });
});
