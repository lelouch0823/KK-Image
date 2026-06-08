import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ActionPreviewCard from '../ActionPreviewCard.vue';

describe('ActionPreviewCard', () => {
  it('renders grouped order preview sections with key business fields', () => {
    const wrapper = mount(ActionPreviewCard, {
      props: {
        action: {
          entityType: 'order',
          title: '订单创建预览',
          summary: {
            productName: '跑鞋',
            salespersonId: 'sp-1',
            quantity: 2,
            color: '黑色',
            size: '42',
            remark: 'VIP客户',
            deadline: '2026-03-15',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('订单创建预览');
    expect(wrapper.text()).toContain('核心信息');
    expect(wrapper.text()).toContain('规格与数量');
    expect(wrapper.text()).toContain('补充说明');
    expect(wrapper.text()).toContain('商品');
    expect(wrapper.text()).toContain('销售员');
    expect(wrapper.text()).toContain('数量');
    expect(wrapper.text()).toContain('颜色');
    expect(wrapper.text()).toContain('尺码');
    expect(wrapper.text()).toContain('备注');
  });

  it('renders purchase-order items as compact rows instead of raw json', () => {
    const wrapper = mount(ActionPreviewCard, {
      props: {
        action: {
          entityType: 'purchase_order',
          title: '采购单创建预览',
          summary: {
            mode: 'manual',
            remark: '急单',
            items: [
              { variant_query: '跑鞋 黑色 42', quantity: 20, unit_cost: 60 },
              { variant_query: '凉鞋 白色 38', quantity: 10, unit_cost: 50 },
            ],
          },
        },
      },
    });

    expect(wrapper.text()).toContain('采购明细');
    expect(wrapper.text()).toContain('跑鞋 黑色 42');
    expect(wrapper.text()).toContain('20');
    expect(wrapper.text()).toContain('60');
    expect(wrapper.text()).toContain('凉鞋 白色 38');
    expect(wrapper.text()).not.toContain('{"variant_query"');
  });

  it('does not expose backend product or variant ids as purchase-order item labels', () => {
    const wrapper = mount(ActionPreviewCard, {
      props: {
        action: {
          entityType: 'purchase_order',
          title: '采购单创建预览',
          summary: {
            items: [{ product_id: 'prod_backend_123', variant_id: 'variant_backend_456' }],
          },
        },
      },
    });

    expect(wrapper.text()).toContain('已选择商品');
    expect(wrapper.text()).not.toContain('prod_backend_123');
    expect(wrapper.text()).not.toContain('variant_backend_456');
  });

  it('summarizes nested object values instead of rendering raw JSON', () => {
    const wrapper = mount(ActionPreviewCard, {
      props: {
        action: {
          entityType: 'customer',
          title: '客户创建预览',
          summary: {
            name: 'Acme',
            profile: {
              tier: 'vip',
              risk_status: 'needs_review',
            },
          },
        },
      },
    });

    expect(wrapper.text()).toContain('已填写 2 项');
    expect(wrapper.text()).not.toContain('{"tier"');
    expect(wrapper.text()).not.toContain('risk_status');
  });
});
