import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderDetail from '@/components/order/OrderDetail.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/composables/useSalesToken', () => ({
  useSalesToken: () => ({ token: { value: 'sales-token' } }),
}));

vi.mock('@/composables/useLightbox', () => ({
  useLightbox: () => ({
    visible: false,
    currentFile: null,
    currentIndex: 0,
    total: 0,
    hasPrev: false,
    hasNext: false,
    open: vi.fn(),
    close: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    download: vi.fn(),
  }),
}));

const baseOrder = {
  id: 'o-1',
  orderNo: 'SO-1',
  status: 'pending',
  quantity: 1,
  hasNewFeedback: true,
  files: [],
  timeline: [],
  currentData: { name: 'Test Product' },
  customer: { name: 'Alice' },
};

const mountOrderDetail = (props = {}) =>
  mount(OrderDetail, {
    props: {
      order: baseOrder,
      mode: 'sales',
      ...props,
    },
    global: {
      stubs: {
        OrderTimeline: true,
        OrderFileGrid: true,
        OrderInfoCard: true,
        OrderPersonCard: true,
        OrderStatusHeader: true,
        OrderLinesCard: true,
        OrderPrintView: true,
        OrderEditModal: true,
        Modal: true,
        ConfirmDialog: true,
        Lightbox: true,
        AppIcon: true,
      },
    },
  });

describe('OrderDetail recovery UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows recoverable warning when markAsRead fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const wrapper = mountOrderDetail();
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="mark-read-warning"]').exists()).toBe(true);
    });
    expect(wrapper.find('[data-testid="mark-read-retry"]').exists()).toBe(true);
  });

  it('comment submit failure preserves input and exposes retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const wrapper = mountOrderDetail({ commentError: 'send failed', pendingComment: 'hello' });
    await wrapper.vm.$nextTick();

    const input = wrapper.find('input');
    expect(input.element.value).toBe('hello');
    expect(wrapper.find('[data-testid="comment-retry"]').exists()).toBe(true);

    await wrapper.get('[data-testid="comment-retry"]').trigger('click');
    expect(wrapper.emitted('comment')?.[0]?.[0]).toBe('hello');
  });
});
