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
          RouterLink: { template: '<a><slot /></a>' },
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
});
