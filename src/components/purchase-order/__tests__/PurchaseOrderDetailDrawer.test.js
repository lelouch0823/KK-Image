import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { mount } from '@vue/test-utils';
import PurchaseOrderDetailDrawer from '../PurchaseOrderDetailDrawer.vue';

const t = (key, fallback) => fallback || key;

const helpers = {
  formatInteger: (value) => String(Number(value || 0)),
  formatPurchaseCurrency: (value, currency = 'CNY') => `${currency} ${Number(value || 0)}`,
  formatDateTime: () => '2026-04-15 12:00',
  getProgressStatusLabel: () => '部分到货',
  getProgressStatusVariant: () => 'primary',
  buildReceiptProgressSummary: (record) =>
    `已到 ${Number(record.received_qty || 0)} / ${Number(record.ordered_qty || record.quantity || 0)} · 待收 ${Number(record.outstanding_qty || 0)}`,
  buildReceiptMeta: () => '2 次入库 · 最近到货 2026-04-15 12:00',
  getStepperProgress: () => '50%',
  getStepIconClasses: () => 'border-primary bg-primary text-white',
  isStepCompleted: () => false,
  hasReceiptMeta: () => true,
  canReverseReceipt: (receipt) => Number(receipt.available_reversal_qty || 0) > 0,
};

describe('PurchaseOrderDetailDrawer', () => {
  it('renders summary, progress, cost, items, and receipts regions from the detail payload', () => {
    const wrapper = mount(PurchaseOrderDetailDrawer, {
      props: {
        show: true,
        detailLoading: false,
        detail: {
          id: 'po-1',
          po_no: 'PO-20260415-001',
          status: 'shipping',
          display_status: 'partially_received',
          ordered_qty: 12,
          received_qty: 4,
          cancelled_qty: 1,
          outstanding_qty: 7,
          item_count: 1,
          total_goods_cost: 306,
          currency: 'CNY',
          allocation_method: 'by_quantity',
          estimated_shipping_cost: 120,
          estimated_tariff_cost: 60,
          actual_shipping_cost: 100,
          actual_tariff_cost: 50,
          items: [
            {
              id: 'item-1',
              product_id: 'prod-1',
              product_name: 'Premium Canvas Bag',
              product_brand: 'KK',
              product_sku: 'KK-BAG-01',
              quantity: 12,
              received_qty: 4,
              cancelled_qty: 1,
              receipt_count: 2,
              outstanding_qty: 7,
              variant_options: { Color: 'Black', Size: 'Large' },
              product_specifications: { Material: 'Canvas' },
              product_images: [],
            },
          ],
          receipts: [
            {
              id: 'receipt-1',
              product_name: 'Premium Canvas Bag',
              product_sku: 'KK-BAG-01',
              received_qty: 4,
              available_reversal_qty: 4,
              reversal_count: 0,
              reversed_qty: 0,
              received_at: Date.UTC(2026, 3, 15),
              note: 'first truck arrived',
              variant_options: { Color: 'Black' },
            },
          ],
        },
        statusConfig: {
          shipping: { label: '运输中' },
          arrived: { label: '已到货' },
        },
        summaryCards: [
          { key: 'ordered', label: '采购数量', value: '12', hint: '1 条明细' },
          { key: 'received', label: '已到货', value: '4', hint: '部分到货' },
        ],
        nextStatuses: ['arrived'],
        stepsList: [
          { value: 'draft', label: '草稿' },
          { value: 'ordered', label: '已下单' },
          { value: 'shipping', label: '运输中' },
          { value: 'arrived', label: '已到货' },
        ],
        receiptTimeline: [
          {
            id: 'receipt-1',
            product_name: 'Premium Canvas Bag',
            product_sku: 'KK-BAG-01',
            received_qty: 4,
            available_reversal_qty: 4,
            reversal_count: 0,
            reversed_qty: 0,
            received_at: Date.UTC(2026, 3, 15),
            note: 'first truck arrived',
            variant_options: { Color: 'Black' },
          },
        ],
        receiptReceivableCount: 1,
        canRecordReceipts: true,
        canCloseShortages: true,
        t,
        helpers,
        getFileUrl: (id) => `/file/${id}`,
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
          ActionBar: { template: '<div><slot name="leading" /><slot /></div>' },
          StatePanel: { template: '<section><slot /></section>' },
          AppButton: { template: '<button><slot /></button>' },
          Teleport: true,
          Transition: false,
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppInput: { template: '<input />' },
          StatusBadge: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-detail-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-close"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-cost"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-items"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="purchase-order-detail-receipts"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Premium Canvas Bag');
    expect(wrapper.get('[data-testid="purchase-order-detail-item-progress"]').text()).toContain(
      '已到 4 / 12'
    );
    expect(
      wrapper.get('[data-testid="purchase-order-detail-item-variant-options"]').text()
    ).toContain('Color: Black');
    expect(wrapper.get('[data-testid="purchase-order-open-reversal-modal"]').text()).toContain(
      'purchaseOrder.action.reverseReceipt'
    );
  });

  it('uses the shared modal shell and action bar contract', async () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/purchase-order/PurchaseOrderDetailDrawer.vue'),
      'utf8'
    );

    expect(source).toContain('<Modal');
    expect(source).toContain('<ActionBar');
    expect(source).toContain('<AppButton');
    expect(source).not.toContain('bg-linear-to');
    expect(source).not.toContain('radial-gradient');
    expect(source).not.toContain('shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)]');
  });

  it('renders unknown purchase-order detail statuses as readable labels', () => {
    const wrapper = mount(PurchaseOrderDetailDrawer, {
      props: {
        show: true,
        detailLoading: false,
        detail: {
          id: 'po-unknown',
          po_no: 'PO-UNKNOWN',
          status: 'quality_hold_status',
          item_count: 0,
          total_goods_cost: 0,
          currency: 'CNY',
          items: [],
          receipts: [],
        },
        statusConfig: {},
        summaryCards: [],
        nextStatuses: ['manual_review_required'],
        stepsList: [{ value: 'quality_hold_status', label: 'Quality Hold Status' }],
        receiptTimeline: [],
        receiptReceivableCount: 0,
        canRecordReceipts: false,
        canCloseShortages: false,
        t,
        helpers,
        getFileUrl: (id) => `/file/${id}`,
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
          ActionBar: { template: '<div><slot name="leading" /><slot /></div>' },
          StatePanel: { template: '<section><slot /></section>' },
          AppButton: { template: '<button><slot /></button>' },
          Teleport: true,
          Transition: false,
          AppImage: { template: '<div />' },
          AppIcon: { template: '<i />' },
          AppInput: { template: '<input />' },
          StatusBadge: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Quality Hold Status');
    expect(wrapper.text()).toContain('Manual Review Required');
    expect(wrapper.text()).not.toContain('quality_hold_status');
    expect(wrapper.text()).not.toContain('manual_review_required');
  });
});
