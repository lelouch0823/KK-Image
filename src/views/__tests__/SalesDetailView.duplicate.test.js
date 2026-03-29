import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SalesDetailView from '../sales/SalesDetailView.vue';

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
  useI18n: () => ({ t: (_key, fallback) => fallback || '' }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { token: 'sales-token', id: 'order-1' } }),
  useRouter: () => ({ push: mocks.routerPush }),
}));

describe('SalesDetailView duplicate prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addSalesComment.mockResolvedValue(true);
    mocks.getSalesOrder.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1001',
      quantity: 9,
      files: [],
      currentData: {
        name: 'Line Snapshot',
        brand: 'KK',
        series: 'Main',
        size: 'L',
        color: 'Black',
        material: 'Cotton',
        quantity: 1,
        remark: 'remark',
      },
    });
  });

  it('uses top-level order quantity when duplicating into create flow', async () => {
    const setPrefillData = vi.fn();

    const wrapper = mount(SalesDetailView, {
      global: {
        provide: {
          salesContext: {
            loadOrders: vi.fn(),
            setPrefillData,
            salesOrderMode: { value: 'line-level' },
          },
        },
        stubs: {
          'router-link': true,
          OrderDetail: {
            props: ['order'],
            template: '<button data-testid="duplicate" @click="$emit(\'duplicate\', order)">duplicate</button>',
          },
          EmptyState: true,
          AsyncStatePanel: true,
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-testid="duplicate"]').trigger('click');

    expect(setPrefillData).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 9,
      })
    );
    expect(mocks.routerPush).toHaveBeenCalledWith('/sales/sales-token/create');
  });
});
