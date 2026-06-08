import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('OutboxEventTable', () => {
  it('renders friendly event and consumer labels instead of raw backend codes', async () => {
    const module = await import('../OutboxEventTable.vue');
    const OutboxEventTable = module.default;

    const wrapper = mount(OutboxEventTable, {
      props: {
        selectedEventId: 'evt-1',
        events: [
          {
            id: 'evt-1',
            event_type: 'purchase_receipt_recorded',
            aggregate_id: 'po-1',
            created_at: '2026-04-13T08:00:00.000Z',
            consumerJobs: [{ consumer_name: 'webhook', status: 'published' }],
          },
        ],
      },
    });

    const text = wrapper.text();

    expect(text).toContain('采购收货已登记');
    expect(text).toContain('Webhook · 已完成');
    expect(text).not.toContain('purchase_receipt_recorded');
    expect(text).not.toContain('webhook · published');
  });
});
