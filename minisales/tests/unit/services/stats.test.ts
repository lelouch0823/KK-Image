import { describe, expect, it, vi } from 'vitest';
import { loadSalesStats } from '../../../miniprogram/services/sales/stats';

describe('sales stats service', () => {
  it('requests the current sales stats contract', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: {
        totalOrders: 12,
        completedOrders: 5,
        monthOrders: 3,
        monthlyTrend: [{ date: '2026-04-01', count: 2 }],
      },
      error: null,
      code: null,
      status: 200,
      payload: { success: true },
    });

    const result = await loadSalesStats({ accessToken: 'sales-token' }, request);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/stats',
        method: 'GET',
      })
    );
    expect(result.data).toEqual({
      totalOrders: 12,
      completedOrders: 5,
      monthOrders: 3,
      monthlyTrend: [{ date: '2026-04-01', count: 2 }],
    });
  });
});
