import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import OrderLogisticsCard from '@/components/order/OrderLogisticsCard.vue';
import OrderPaymentCard from '@/components/order/OrderPaymentCard.vue';
import PriceRuleManager from '@/components/product/PriceRuleManager.vue';
import SpaceDetailModal from '@/components/SpaceDetailModal.vue';
import SubspaceList from '@/components/SubspaceList.vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  authFetchJson: vi.fn(),
  addToast: vi.fn(),
  loadPayments: vi.fn(),
  addPayment: vi.fn(),
  deletePayment: vi.fn(),
  payments: { value: [], __v_isRef: true },
  summary: { value: { orderAmount: 0, totalPaid: 0, outstanding: 0 }, __v_isRef: true },
  loadSpace: vi.fn(),
  updateSpace: vi.fn(),
  addFilesToSpace: vi.fn(),
  removeFilesFromSpace: vi.fn(),
  loadSubspaces: vi.fn(),
  deleteSpace: vi.fn(),
  copyShareLink: vi.fn(),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch, authFetchJson: mocks.authFetchJson }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/usePayments', () => ({
  usePayments: () => ({
    payments: mocks.payments,
    summary: mocks.summary,
    loading: { value: false, __v_isRef: true },
    adding: { value: false, __v_isRef: true },
    loadPayments: mocks.loadPayments,
    addPayment: mocks.addPayment,
    deletePayment: mocks.deletePayment,
  }),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    loadSpace: mocks.loadSpace,
    updateSpace: mocks.updateSpace,
    addFilesToSpace: mocks.addFilesToSpace,
    removeFilesFromSpace: mocks.removeFilesFromSpace,
    loadSubspaces: mocks.loadSubspaces,
    deleteSpace: mocks.deleteSpace,
  }),
}));

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyShareLink: mocks.copyShareLink }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => {
      if (typeof fallback === 'string') return fallback;
      if (typeof fallback === 'object' && fallback?.count !== undefined) {
        return `${fallback.count} 个文件`;
      }
      return '';
    },
  }),
}));

describe('readable fallback labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.payments.value = [];
    mocks.summary.value = { orderAmount: 0, totalPaid: 0, outstanding: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
  });

  it('renders unknown payment methods and carriers as readable labels', async () => {
    mocks.payments.value = [
      {
        id: 'pay-1',
        amount: 120,
        method: 'wire_transfer_custom',
        receivedAt: '2026-04-15T12:00:00.000Z',
      },
    ];
    mocks.summary.value = { orderAmount: 120, totalPaid: 120, outstanding: 0 };
    mocks.loadPayments.mockResolvedValue();
    mocks.authFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          trackingNo: 'TRACK-1',
          carrier: 'custom_express_line',
          tracking: { events: [] },
          carriers: [],
        },
      }),
    });

    const payment = mount(OrderPaymentCard, {
      props: {
        orderId: 'order-1',
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot /></button>' },
          ConfirmDialog: { template: '<div />' },
        },
      },
    });
    await flushPromises();

    const logistics = mount(OrderLogisticsCard, {
      props: {
        orderId: 'order-1',
        initialTrackingNo: 'TRACK-1',
        initialCarrier: 'custom_express_line',
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot /></button>' },
          AppIcon: { template: '<i />' },
          AppInput: { template: '<div><slot name="prepend" /></div>' },
        },
      },
    });
    await flushPromises();

    expect(payment.text()).toContain('Wire Transfer Custom');
    expect(payment.text()).not.toContain('wire_transfer_custom');
    expect(logistics.text()).toContain('Custom Express Line');
    expect(logistics.text()).not.toContain('custom_express_line');
  });

  it('renders unknown product price rule types as readable labels', async () => {
    mocks.authFetchJson.mockResolvedValue({
      data: {
        'variant-1': [
          {
            id: 'rule-1',
            variant_id: 'variant-1',
            price_type: 'regional_special_price',
            price: 99,
          },
        ],
      },
    });

    const wrapper = mount(PriceRuleManager, {
      props: {
        productId: 'product-1',
        variants: [{ id: 'variant-1', sku: 'SKU-1', price: 80, options_values: { color: '黑色' } }],
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot /></button>' },
          AppIcon: { template: '<i />' },
          AppInput: { template: '<div><slot name="prepend" /></div>' },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Regional Special Price');
    expect(wrapper.text()).not.toContain('regional_special_price');
  });

  it('renders unknown space templates as readable labels in detail and subspace lists', async () => {
    mocks.loadSpace.mockResolvedValue({
      id: 'space-1',
      name: '空间',
      template: 'vip_private_gallery',
      isPublic: true,
      files: [],
    });
    mocks.loadSubspaces.mockResolvedValue([
      {
        id: 'sub-1',
        name: '子空间',
        template: 'vip_private_gallery',
        fileCount: 3,
        isPublic: true,
        coverUrl: '',
      },
    ]);

    const detail = mount(SpaceDetailModal, {
      props: {
        space: { id: 'space-1' },
        canManage: true,
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
          StatusBadge: { template: '<div><slot /></div>' },
          FileSelector: { template: '<div />' },
          SpaceAnalytics: { template: '<div />' },
          SubspaceList: { template: '<div />' },
          SpaceFilesTab: { template: '<div />' },
          SpaceSettingsTab: { template: '<div />' },
        },
      },
    });

    const subspaces = mount(SubspaceList, {
      props: {
        spaceId: 'space-1',
        canManage: true,
      },
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          SpaceCreateModal: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          AppImage: { template: '<img />', props: ['src', 'alt'] },
          AppButton: { template: '<button><slot /></button>' },
          AppIcon: { template: '<i />' },
        },
      },
    });
    await flushPromises();

    expect(detail.text()).toContain('VIP Private Gallery');
    expect(subspaces.text()).toContain('VIP Private Gallery');
    expect(detail.text()).not.toContain('vip_private_gallery');
    expect(subspaces.text()).not.toContain('vip_private_gallery');
  });
});
