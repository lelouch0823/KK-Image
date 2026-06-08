import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderTimeline from '@/components/order/OrderTimeline.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, params) => {
      if (key === 'order.timeline.fieldUpdated') return `${params?.field || ''} 已更新`;
      if (key === 'order.timeline.reason') return '原因';
      if (key === 'order.timeline.statusChanged') return '状态已变更';
      if (key === 'sidebar.admin') return '管理员';
      if (key === 'salesperson.title') return '销售管理';
      if (typeof params === 'string') return params;
      return key;
    },
    locale: { value: 'zh-CN' },
  }),
}));

vi.mock('@/utils/formatters', () => ({
  formatTimelineTime: () => '2026-04-15 12:00',
}));

describe('OrderTimeline display labels', () => {
  it('renders unknown status and reason codes as readable labels', () => {
    const wrapper = mount(OrderTimeline, {
      props: {
        timeline: [
          {
            id: 'tl-1',
            actionType: 'field_updated',
            actorName: 'Admin',
            actorType: 'admin',
            actorId: 'admin-1',
            createdAt: 1710000000000,
            fieldName: 'custom_status_code',
            oldValue: 'legacy_pending_state',
            newValue: 'manual_review_required',
            reason: 'warehouse_quality_hold',
          },
          {
            id: 'tl-2',
            actionType: 'status_changed',
            actorName: 'Admin',
            actorType: 'admin',
            actorId: 'admin-1',
            createdAt: 1710000001000,
            newValue: 'manual_review_required',
            reason: 'ops_manual_review',
          },
        ],
        maxItems: 5,
      },
      global: {
        stubs: {
          AppIcon: true,
          AppButton: { template: '<button><slot /></button>' },
          StatusBadge: { template: '<span><slot /></span>' },
          AppTable: { template: '<div><slot name="cell-actions" :row="data[0]" /></div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Custom Status Code');
    expect(wrapper.text()).toContain('Legacy Pending State');
    expect(wrapper.text()).toContain('Manual Review Required');
    expect(wrapper.text()).toContain('Warehouse Quality Hold');
    expect(wrapper.text()).toContain('Ops Manual Review');
    expect(wrapper.text()).not.toContain('custom_status_code');
    expect(wrapper.text()).not.toContain('legacy_pending_state');
    expect(wrapper.text()).not.toContain('manual_review_required');
    expect(wrapper.text()).not.toContain('warehouse_quality_hold');
    expect(wrapper.text()).not.toContain('ops_manual_review');
  });
});
