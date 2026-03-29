import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, reactive } from 'vue';
import OrderManager from '../OrderManager.vue';

vi.mock('@/composables/useOrders', () => ({
  useOrders: () => ({
    orders: ref([
      {
        id: 'order-1',
        orderNo: 'SO-1',
        status: 'pending',
        procurementStatus: 'ordered',
        displayStatus: 'partially_received',
      },
    ]),
    salespersons: ref([]),
    statuses: ref(['pending']),
    procurementStatuses: ref([]),
    loading: ref(false),
    error: ref(''),
    errorCode: ref(''),
    pagination: reactive({ page: 1, total: 1, totalPages: 1 }),
    loadOrders: vi.fn().mockResolvedValue(),
    getOrder: vi.fn().mockResolvedValue(null),
    updateOrder: vi.fn().mockResolvedValue(true),
    changeStatus: vi.fn().mockResolvedValue(true),
    addComment: vi.fn().mockResolvedValue(true),
    batchAction: vi.fn().mockResolvedValue(true),
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
  useI18n: () => ({ t: (_key, fallback) => fallback || '' }),
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
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe('OrderManager line-level statuses', () => {
  it('prefers displayStatus over procurementStatus in the admin list badge', () => {
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }))
    );

    const wrapper = mount(OrderManager, {
      global: {
        stubs: {
          ManagementListShell: { template: '<div><slot name="content" /><slot /></div>' },
          PermissionDeniedState: { template: '<div />' },
          Modal: { template: '<div><slot name="header" /><slot /></div>', props: ['modelValue', 'title', 'size'] },
          OrderDashboard: { template: '<div />' },
          OrderTable: {
            props: ['data'],
            template:
              '<div><slot name="status" v-for="order in data" :order="order" :key="order.id" /></div>',
          },
          OrderFilters: { template: '<div />' },
          OrderStatusChanger: { template: '<div />' },
          OrderProcurementBadge: {
            props: ['status'],
            template: '<div data-testid="procurement-badge">{{ status }}</div>',
          },
          Pagination: { template: '<div />' },
          OrderCards: { template: '<div />' },
          AppIcon: { template: '<i />' },
          OrderCreateModal: { template: '<div />' },
          OrderEditModal: { template: '<div />' },
          OrderWorkflowModal: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          DestructiveConfirmModal: { template: '<div />' },
        },
      },
    });

    expect(wrapper.get('[data-testid="procurement-badge"]').text()).toBe('partially_received');
  });
});
