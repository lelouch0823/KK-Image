import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderPrintView from '@/components/order/OrderPrintView.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('OrderPrintView historical snapshot fallback', () => {
  it('falls back to originalData snapshot fields when currentData is sparse', () => {
    const wrapper = mount(OrderPrintView, {
      props: {
        order: {
          id: 'o-1',
          orderNo: 'SO-1',
          status: 'confirmed',
          createdAt: 1710000000000,
          quantity: 3,
          files: [],
          timeline: [],
          lines: [{ id: 'line-1', snapshotName: 'Snapshot Chair' }],
          currentData: { name: 'Current Name' },
          originalData: {
            brand: 'Archive Brand',
            series: 'Archive Series',
            size: 'Archive Size',
            color: 'Archive Color',
            material: 'Archive Material',
            remark: 'Archive Remark',
          },
        },
      },
      global: {
        stubs: {
          AppImage: true,
          OrderProcurementBadge: true,
          OrderTimeline: true,
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain('Current Name');
    expect(text).toContain('Archive Brand');
    expect(text).toContain('Archive Series');
    expect(text).toContain('Archive Size');
    expect(text).toContain('Archive Color');
    expect(text).toContain('Archive Material');
    expect(text).toContain('Archive Remark');
  });
});
