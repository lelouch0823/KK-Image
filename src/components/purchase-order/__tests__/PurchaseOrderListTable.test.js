import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import PurchaseOrderListTable from '../PurchaseOrderListTable.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

const AppTableStub = defineComponent({
  name: 'AppTable',
  props: {
    columns: { type: Array, default: () => [] },
    data: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyText: { type: String, default: '' },
    noBorder: { type: Boolean, default: false },
  },
  emits: ['row-click'],
  template: `
    <div data-testid="purchase-order-list-table-stub">
      <slot name="toolbar" />
      <div v-if="data.length > 0">
        <slot name="cell-status" :row="data[0]" :value="data[0].status" :index="0" />
        <button data-testid="purchase-order-row-click" @click="$emit('row-click', data[0])">
          open
        </button>
      </div>
    </div>
  `,
});

const StatusBadgeStub = defineComponent({
  name: 'StatusBadge',
  props: {
    variant: { type: String, default: 'default' },
  },
  template: '<div data-testid="status-badge"><slot /></div>',
});

describe('PurchaseOrderListTable', () => {
  it('renders primary status plus receipt progress summary and re-emits row clicks', async () => {
    const row = {
      id: 'po-1',
      status: 'ordered',
      display_status: 'partially_received',
      ordered_qty: 12,
      received_qty: 4,
      cancelled_qty: 1,
    };

    const wrapper = mount(PurchaseOrderListTable, {
      props: {
        columns: [{ key: 'status', label: '状态' }],
        list: [row],
        loading: false,
        emptyText: '暂无采购单',
        statusConfig: {
          ordered: { label: '已下单' },
        },
        formatDate: () => '2026-04-15',
        formatPurchaseCurrency: () => '¥100.00',
        buildReceiptProgressSummary: () => '已到 4 / 12 · 待收 7 · 取消 1',
        getProgressStatusLabel: () => '部分到货',
        getProgressStatusVariant: () => 'primary',
        getListStatusVariant: () => 'warning',
      },
      global: {
        stubs: {
          AppTable: AppTableStub,
          StatusBadge: StatusBadgeStub,
        },
      },
    });

    expect(wrapper.text()).toContain('purchaseOrder.ui.tableTitle');
    expect(wrapper.text()).toContain('已下单');
    expect(wrapper.text()).toContain('部分到货');
    expect(wrapper.text()).toContain('已到 4 / 12');
    expect(wrapper.text()).toContain('待收 7');

    await wrapper.get('[data-testid="purchase-order-row-click"]').trigger('click');
    expect(wrapper.emitted('row-click')).toEqual([[row]]);
  });

  it('renders unknown purchase-order statuses as readable labels instead of raw backend codes', () => {
    const wrapper = mount(PurchaseOrderListTable, {
      props: {
        columns: [{ key: 'status', label: '状态' }],
        list: [
          {
            id: 'po-unknown',
            status: 'quality_hold_status',
          },
        ],
        statusConfig: {},
        formatDate: () => '2026-04-15',
        formatPurchaseCurrency: () => '¥100.00',
        buildReceiptProgressSummary: () => '',
        getProgressStatusLabel: () => '',
        getProgressStatusVariant: () => 'default',
        getListStatusVariant: () => 'default',
      },
      global: {
        stubs: {
          AppTable: AppTableStub,
          StatusBadge: StatusBadgeStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Quality Hold Status');
    expect(wrapper.text()).not.toContain('quality_hold_status');
  });
});
