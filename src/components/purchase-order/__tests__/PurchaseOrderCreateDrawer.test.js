import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { mount } from '@vue/test-utils';
import PurchaseOrderCreateDrawer from '../PurchaseOrderCreateDrawer.vue';

const t = (key, fallback) => {
  const messages = {
    'purchaseOrder.form.totalQty': '总数量',
    'purchaseOrder.form.quantityWarning': '数量不足',
    'purchaseOrder.form.itemList': '采购商品',
  };

  return fallback || messages[key] || key;
};

describe('PurchaseOrderCreateDrawer', () => {
  it('renders draft item list, totals, and create action from create-flow state', () => {
    const wrapper = mount(PurchaseOrderCreateDrawer, {
      props: {
        show: true,
        t,
        createForm: {
          remark: 'rush restock',
          currency: 'CNY',
          estimated_shipping_cost: 12,
          estimated_tariff_cost: 6,
          allocation_method: 'by_quantity',
        },
        currencyOptions: [{ value: 'CNY', label: 'CNY · 人民币' }],
        allocationMethodOptions: [{ value: 'by_quantity', label: '按数量' }],
        poItems: [
          {
            product_name: 'Premium Canvas Bag',
            sku: 'KK-BAG-01',
            quantity: 3,
            unit_cost: 20,
            required_quantity: 5,
            pre_order_id: 'order-1',
          },
        ],
        totalCreateQty: 3,
        shortageItems: [{ product_name: 'Premium Canvas Bag', quantity: 3, required_quantity: 5 }],
        getFileUrl: (id) => `/file/${id}`,
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
          ActionBar: { template: '<div><slot name="leading" /><slot /></div>' },
          StatePanel: { template: '<section><slot /></section>' },
          AppButton: { template: '<button><slot /></button>' },
          AppTable: {
            props: ['data'],
            template: `
              <div>
                <slot name="cell-product" :row="data[0]" :index="0" />
                <slot name="cell-quantity" :row="data[0]" :index="0" />
                <slot name="cell-unitCost" :row="data[0]" :index="0" />
                <slot name="cell-source" :row="data[0]" :index="0" />
                <slot name="cell-actions" :row="data[0]" :index="0" />
              </div>
            `,
          },
          AppIcon: { template: '<i />' },
          AppImage: { template: '<div />' },
          AppInput: {
            template: '<div />',
            props: ['modelValue', 'type', 'min', 'step', 'size', 'placeholder'],
          },
          AppSelect: {
            template: '<select />',
            props: ['modelValue', 'options', 'placeholder', 'size'],
          },
          StatusBadge: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-create-shell"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Premium Canvas Bag');
    expect(wrapper.text()).toContain('采购策略与费用设置');
    expect(wrapper.text()).toContain('采购商品');
    expect(wrapper.text()).toContain('总数量');
    expect(wrapper.text()).toContain('3');
    expect(wrapper.text()).toContain('数量不足');
    expect(wrapper.get('[data-testid="purchase-order-create-submit"]').text()).toContain('创建');
  });

  it('uses the shared modal shell and action bar contract', async () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/purchase-order/PurchaseOrderCreateDrawer.vue'),
      'utf8'
    );

    expect(source).toContain('<Modal');
    expect(source).toContain('<ActionBar');
    expect(source).toContain('<AppTable');
    expect(source).toContain('<AppButton');
    expect(source).not.toContain('bg-linear-to');
    expect(source).not.toContain('radial-gradient');
  });
});
