import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ActionResultCard from '../ActionResultCard.vue';

describe('ActionResultCard', () => {
  it('renders entity label and target module guidance', () => {
    const wrapper = mount(ActionResultCard, {
      props: {
        action: {
          successMessage: '订单已创建，请前往订单管理查看。',
          createdEntityLabel: 'ORD-20260309-001',
          targetModule: 'orders',
        },
      },
    });

    expect(wrapper.text()).toContain('创建成功');
    expect(wrapper.text()).toContain('ORD-20260309-001');
    expect(wrapper.text()).toContain('订单管理');
  });

  it('shows a dedicated destination hint area for the target module', () => {
    const wrapper = mount(ActionResultCard, {
      props: {
        action: {
          successMessage: '采购单已创建，请前往采购单管理查看。',
          createdEntityLabel: 'PO-20260309-001',
          targetModule: 'purchaseOrders',
        },
      },
    });

    expect(wrapper.find('[data-testid="result-destination"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('前往查看');
    expect(wrapper.text()).toContain('采购单管理');
  });
});
