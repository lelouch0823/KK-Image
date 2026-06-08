import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('OutboxReplayPanel', () => {
  it('renders a structured replay workspace for the selected event', async () => {
    const module = await import('../OutboxReplayPanel.vue');
    const OutboxReplayPanel = module.default;

    const wrapper = mount(OutboxReplayPanel, {
      props: {
        event: {
          id: 'evt-1',
          event_type: 'purchase_receipt_recorded',
          aggregate_id: 'po-1',
          consumerJobs: [{ consumer_name: 'notification', status: 'failed' }],
        },
        detailLoading: false,
        replayLoading: false,
        lastReplayResult: {
          runId: 'replay-1',
          status: 'completed',
        },
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot />{{ text }}</button>', props: ['text'] },
          AppInput: { template: '<input />' },
        },
      },
    });

    expect(wrapper.find('[data-testid="outbox-selection-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="outbox-replay-actions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="outbox-replay-result"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('最近一次操作结果');
  });

  it('renders friendly event, consumer, and replay result labels instead of raw codes', async () => {
    const module = await import('../OutboxReplayPanel.vue');
    const OutboxReplayPanel = module.default;

    const wrapper = mount(OutboxReplayPanel, {
      props: {
        event: {
          id: 'evt-1',
          event_type: 'purchase_receipt_recorded',
          aggregate_id: 'po-1',
          consumerJobs: [
            { consumer_name: 'notification', status: 'failed' },
            { consumer_name: 'webhook', status: 'published' },
          ],
        },
        detailLoading: false,
        replayLoading: false,
        lastReplayResult: {
          dryRun: true,
          matchedJobs: 2,
          consumerName: 'webhook',
          status: 'completed',
          affectedEvents: ['evt-1'],
        },
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot />{{ text }}</button>', props: ['text'] },
          AppInput: { template: '<input />' },
        },
      },
    });

    const text = wrapper.text();

    expect(text).toContain('采购收货已登记');
    expect(text).toContain('通知 · 失败');
    expect(text).toContain('Webhook · 已完成');
    expect(text).toContain('目标消费者');
    expect(text).toContain('命中消费者');
    expect(text).not.toContain('purchase_receipt_recorded');
    expect(text).not.toContain('notification · failed');
    expect(text).not.toContain('"dryRun"');
    expect(text).not.toContain('"affectedEvents"');
  });
});
