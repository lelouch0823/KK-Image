import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderPrintView from '@/components/order/OrderPrintView.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, paramsOrFallback) => {
      if (key === 'order.detail.multilineSummary' && paramsOrFallback && typeof paramsOrFallback === 'object') {
        return `多商品订单（${paramsOrFallback.count}项）`;
      }
      if (typeof paramsOrFallback === 'string') return paramsOrFallback;
      return key;
    },
  }),
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
          OrderLineProcurementState: true,
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

  it('renders a multiline summary header and clears single-product snapshot fields for mixed orders', () => {
    const wrapper = mount(OrderPrintView, {
      props: {
        order: {
          id: 'o-2',
          orderNo: 'SO-2',
          status: 'confirmed',
          createdAt: 1710000000000,
          quantity: 5,
          files: [],
          timeline: [],
          lines: [
            { id: 'line-1', snapshotName: 'Desk', orderedQuantity: 2, displayStatus: 'ordered' },
            { id: 'line-2', snapshotName: 'Chair', orderedQuantity: 3, displayStatus: 'ordered' },
          ],
          currentData: {
            name: 'Header Snapshot',
            brand: 'KK',
            series: 'Series A',
            size: '200x90',
            color: 'Walnut',
            material: 'Wood',
            remark: 'Pack separately',
          },
          originalData: {},
        },
      },
      global: {
        stubs: {
          AppImage: true,
          OrderLineProcurementState: true,
          OrderTimeline: true,
        },
      },
    });

    const values = wrapper.findAll('dd').map((node) => node.text());
    expect(values[0]).toBe('多商品订单（2项）');
    expect(values[1]).toBe('5');
    expect(values[2]).toBe('-');
    expect(values[3]).toBe('-');
    expect(values[4]).toBe('-');
    expect(values[5]).toBe('-');
    expect(values[6]).toBe('-');
    expect(values[7]).toBe('Pack separately');
  });
});
