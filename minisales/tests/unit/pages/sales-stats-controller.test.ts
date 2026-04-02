import { describe, expect, it } from 'vitest';
import { buildStatsViewModel } from '../../../miniprogram/pages/stats/controller';

describe('sales stats controller', () => {
  it('builds stable KPI cards and chart labels from monthly trend data', () => {
    const model = buildStatsViewModel({
      totalOrders: 12,
      completedOrders: 4,
      monthOrders: 6,
      monthlyTrend: [
        { date: '2026-04-01', count: 1 },
        { date: '2026-04-02', count: 3 },
      ],
    }, { loginMethod: 'password' });

    expect(model.metrics[0].value).toBe(12);
    expect(model.chartPoints[1].count).toBe(3);
    expect(model.showBindWechatAction).toBe(true);
  });
});
