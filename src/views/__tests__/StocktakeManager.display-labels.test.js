import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import StocktakeManager from '../StocktakeManager.vue';

const mocks = vi.hoisted(() => ({
  authFetchJson: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetchJson: mocks.authFetchJson,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

describe('StocktakeManager display labels', () => {
  it('renders unknown stocktake status as a readable label instead of an i18n key', async () => {
    mocks.authFetchJson.mockResolvedValueOnce({
      data: [
        {
          id: 'stocktake-1',
          status: 'warehouse_quality_hold',
          itemCount: 3,
          countedItems: 1,
          diffItems: 0,
          createdAt: '2026-06-01T00:00:00.000Z',
          notes: '',
        },
      ],
      total: 1,
    });

    const wrapper = mount(StocktakeManager, {
      global: {
        stubs: {
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: { template: '<i />' },
          AppInput: { template: '<input />' },
          AppTable: {
            props: ['columns', 'data'],
            template: `
              <div>
                <div v-for="row in data" :key="row.id">
                  <slot name="cell-status" :row="row" />
                  <slot name="cell-itemCount" :row="row" />
                </div>
              </div>
            `,
          },
          ConfirmDialog: { template: '<div />' },
          DashboardShell: {
            template:
              '<section><slot name="actions" /><slot name="summary" /><slot name="main" /></section>',
          },
          MetricTile: { props: ['label', 'value'], template: '<div>{{ label }}:{{ value }}</div>' },
          StatGroup: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Warehouse Quality Hold');
    expect(wrapper.text()).not.toContain('stocktake.status.warehouse_quality_hold');
    expect(wrapper.text()).not.toContain('warehouse_quality_hold');
  });
});
