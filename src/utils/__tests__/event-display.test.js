import { describe, expect, it } from 'vitest';

describe('event display helpers', () => {
  it('formats backend codes and structured values as readable labels', async () => {
    const { formatReadableLabel, formatSummaryValue } = await import('../event-display');

    expect(formatReadableLabel('custom_adapter')).toBe('Custom Adapter');
    expect(formatReadableLabel('purchase_order.item.delete')).toBe('Purchase Order Item Delete');
    expect(formatReadableLabel('partialSuccess')).toBe('Partial Success');
    expect(formatReadableLabel('')).toBe('-');

    expect(formatSummaryValue({ customer_tier: 'vip', risk_status: 'needs_review' })).toBe(
      '已填写 2 项'
    );
    expect(formatSummaryValue([{ id: 'item-1' }, { id: 'item-2' }])).toBe('2 项');
    expect(formatSummaryValue(['红色', 'L'])).toBe('红色, L');
  });

  it('formats domain event types and consumer jobs for operators', async () => {
    const { formatConsumerJobLabel, formatDomainEventType } = await import('../event-display');

    expect(formatDomainEventType('purchase_receipt_recorded')).toBe('采购收货已登记');
    expect(formatDomainEventType('inventory_received')).toBe('库存已入库');
    expect(formatDomainEventType('order_procurement_progressed')).toBe('预定单采购进度已推进');
    expect(formatDomainEventType('unknown_future_event')).toBe('UnknownFuture事件');
    expect(formatConsumerJobLabel({ consumer_name: 'notification', status: 'failed' })).toBe(
      '通知 · 失败'
    );
    expect(formatConsumerJobLabel({ consumer_name: 'webhook', status: 'published' })).toBe(
      'Webhook · 已完成'
    );
  });

  it('builds structured replay and backup restore summaries instead of JSON dumps', async () => {
    const { buildBackupRestoreSummaryRows, buildReplayResultSummaryRows } = await import(
      '../event-display'
    );

    expect(
      buildReplayResultSummaryRows({
        dryRun: true,
        matchedJobs: 0,
        consumerName: 'webhook',
        status: 'completed',
      })
    ).toEqual(
      expect.arrayContaining([
        { label: '操作模式', value: 'Dry Run（只检查不执行）' },
        { label: '目标消费者', value: 'Webhook' },
        { label: '命中消费者', value: '0 个' },
      ])
    );

    expect(
      buildBackupRestoreSummaryRows({
        environment: 'production',
        mode: 'dry_run',
        checkedTables: 8,
        restoredRows: 0,
      })
    ).toEqual(
      expect.arrayContaining([
        { label: '运行环境', value: '生产环境' },
        { label: '恢复模式', value: '试运行恢复' },
        { label: '检查数据表', value: '8 张' },
        { label: '恢复数据行', value: '0 行' },
      ])
    );
  });
});
