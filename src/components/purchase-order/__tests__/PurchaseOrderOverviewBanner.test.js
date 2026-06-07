import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import PurchaseOrderOverviewBanner from '../PurchaseOrderOverviewBanner.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, payload) => `总计 ${payload?.count ?? ''}`.trim(),
  }),
}));

const MetricTileStub = defineComponent({
  name: 'MetricTile',
  props: {
    label: { type: String, default: '' },
    value: { type: [String, Number], default: '' },
    active: { type: Boolean, default: false },
  },
  emits: ['click'],
  template: `
    <button
      data-testid="metric-tile"
      :data-active="active ? 'yes' : 'no'"
      @click="$emit('click')"
    >
      {{ label }} {{ value }}
    </button>
  `,
});

describe('PurchaseOrderOverviewBanner', () => {
  it('renders stat cards and emits filter toggles', async () => {
    const wrapper = mount(PurchaseOrderOverviewBanner, {
      props: {
        title: '采购单',
        description: '采购流程总览',
        total: 18,
        loading: false,
        stats: { total: 18 },
        activeStatus: 'draft',
        statCards: [
          { key: '', label: '全部', count: 18, icon: 'bars-4', tone: 'primary' },
          { key: 'draft', label: '草稿', count: 5, icon: 'pencil-square', tone: 'slate' },
        ],
        consoleSignals: [
          {
            key: 'active',
            label: '在途链路',
            value: '9',
            hint: '已下单、运输中、待结算采购单总和。',
          },
        ],
      },
      global: {
        stubs: {
          MetricTile: MetricTileStub,
        },
      },
    });

    expect(wrapper.find('[data-testid="purchase-order-console-banner"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('采购单');
    expect(wrapper.text()).toContain('采购流程总览');
    expect(wrapper.text()).toContain('全部 18');
    expect(wrapper.text()).toContain('草稿 5');
    expect(wrapper.text()).toContain('在途链路');
    expect(wrapper.text()).toContain('9');

    const tiles = wrapper.findAll('[data-testid="metric-tile"]');
    expect(tiles).toHaveLength(2);
    expect(tiles[1].attributes('data-active')).toBe('yes');

    await tiles[1].trigger('click');
    expect(wrapper.emitted('toggle-status-filter')).toEqual([['draft']]);
  });
});
