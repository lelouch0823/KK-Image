import { describe, it, expect, vi } from 'vitest';
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

const order = {
  id: 'order-1',
  orderNo: 'SO-1001',
  status: 'confirmed',
  quantity: 7,
  procurementStatus: 'ordered',
  displayStatus: 'partially_received',
  files: [],
  timeline: [],
  shipments: [
    {
      id: 'ship-1',
      actionType: 'shipped',
      quantity: 2,
      actorName: 'Admin',
      lineLabel: 'Line A',
      createdAt: 1710000000000,
    },
  ],
  returns: [
    {
      id: 'ret-1',
      status: 'restocked',
      reason: 'damage',
      quantity: 1,
      createdBy: 'Admin',
      lineLabel: 'Line A',
      createdAt: 1710003600000,
    },
  ],
  currentData: {
    name: 'Legacy Snapshot Name',
  },
  lines: [
    {
      id: 'line-1',
      snapshotName: 'Line A',
      orderedQuantity: 7,
      procuredQuantity: 7,
      receivedQuantity: 3,
      shippedQuantity: 0,
      cancelledQuantity: 0,
      displayStatus: 'partially_received',
    },
  ],
};

describe('OrderDetail line-level rendering', () => {
  it('passes aggregated display status to the status header and renders lines card', () => {
    const wrapper = mount(OrderDetail, {
      props: {
        order,
        mode: 'admin',
      },
      global: {
        stubs: {
          OrderTimeline: true,
          OrderFileGrid: true,
          OrderInfoCard: true,
          OrderPersonCard: true,
          OrderStatusHeader: {
            props: ['procurementStatus', 'deliveryStatus'],
            template: '<div data-testid="status-header">{{ procurementStatus }}|{{ deliveryStatus }}</div>',
          },
          OrderShipmentHistoryCard: {
            props: ['shipments'],
            template: '<div data-testid="shipment-history-card">{{ shipments.length }}</div>',
          },
          OrderReturnHistoryCard: {
            props: ['returns'],
            template: '<div data-testid="return-history-card">{{ returns.length }}</div>',
          },
          OrderLinesCard: {
            props: ['lines', 'mode'],
            template: '<div data-testid="order-lines-card">{{ mode }}-{{ lines.length }}-{{ lines[0].snapshotName }}</div>',
          },
          OrderCommentInput: true,
          OrderPrintView: true,
          OrderEditModal: true,
          Modal: true,
          ConfirmDialog: true,
          Lightbox: true,
          AppIcon: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="status-header"]').text()).toBe('partially_received|not_shipped');
    expect(wrapper.get('[data-testid="order-lines-card"]').text()).toBe('admin-1-Line A');
    expect(wrapper.get('[data-testid="shipment-history-card"]').text()).toBe('1');
    expect(wrapper.get('[data-testid="return-history-card"]').text()).toBe('1');
  });
});
