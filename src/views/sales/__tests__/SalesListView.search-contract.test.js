import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalesListView from '../SalesListView.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { token: 'sales-token' }, path: '/sales/sales-token' }),
}));

describe('SalesListView search contract', () => {
  const observer = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => observer)
    );
  });

  it('reloads sales orders from the server when search query changes', async () => {
    const searchQuery = ref('');
    const loadOrders = vi.fn();

    const wrapper = mount(SalesListView, {
      global: {
        provide: {
          salesContext: {
            orders: ref([]),
            loading: ref(false),
            loadOrders,
            pagination: { page: 1, totalPages: 3, total: 45 },
            searchQuery,
            salesOrderMode: ref('legacy'),
            salesOrderStateMachine: { error: ref('') },
          },
        },
        stubs: {
          OrderList: true,
          AppIcon: true,
          SearchInput: {
            template: '<input @input="$emit(\'search\')" />',
            emits: ['search'],
          },
        },
      },
    });

    searchQuery.value = 'desk';
    await wrapper.find('input').trigger('input');
    await Promise.resolve();

    expect(loadOrders).toHaveBeenCalledWith(1, false, 'desk');
  });
});
