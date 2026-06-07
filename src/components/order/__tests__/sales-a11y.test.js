import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import OrderLogin from '@/components/order/OrderLogin.vue';
import SalesListView from '@/views/sales/SalesListView.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { token: 'sales-token' }, path: '/sales/sales-token' }),
}));

describe('sales a11y', () => {
  const mockObserver = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };

  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => mockObserver)
  );

  it('login error uses aria-live alert region', () => {
    const wrapper = mount(OrderLogin, {
      props: {
        error: 'invalid password',
        onSubmit: vi.fn(),
      },
      global: {
        stubs: { AppIcon: true },
      },
    });

    const alert = wrapper.find('[data-testid="login-error"]');
    expect(alert.exists()).toBe(true);
    expect(alert.attributes('role')).toBe('alert');
    expect(alert.attributes('aria-live')).toBe('assertive');
  });

  it('primary touch targets are >= 44px in sales flow', async () => {
    const searchQuery = ref('abc');
    const wrapper = mount(SalesListView, {
      global: {
        provide: {
          salesContext: {
            orders: ref([]),
            loading: ref(false),
            loadOrders: vi.fn(),
            pagination: { page: 1, totalPages: 1, total: 0 },
            searchQuery,
            salesOrderMode: ref('refactor'),
            salesOrderStateMachine: { error: ref('') },
          },
        },
        stubs: {
          OrderList: true,
          AppIcon: true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    const clearBtn = wrapper.find('button');

    expect(clearBtn.exists()).toBe(true);
    expect(clearBtn.classes()).toContain('min-h-11');
  });
});
