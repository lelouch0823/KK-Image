import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryFirst: vi.fn(),
}));

vi.mock('../../lib/db/query.js', () => ({
  query: (...args) => mocks.query(...args),
  queryFirst: (...args) => mocks.queryFirst(...args),
}));

import { OrderStatsRepository } from '../OrderStatsRepository.js';

describe('OrderStatsRepository full coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.query.mockReset();
    mocks.queryFirst.mockReset();
  });

  it('passes SQL, bindings, and labels through runQuery wrappers', async () => {
    const db = { prepare: vi.fn() };
    const repo = new OrderStatsRepository(db);
    mocks.query.mockResolvedValueOnce({ results: [] });
    mocks.queryFirst.mockResolvedValueOnce({ count: 1 });

    await expect(repo.runQuery('SELECT 1', ['a'], 'label.a')).resolves.toEqual({ results: [] });
    await expect(repo.runQueryFirst('SELECT 2', ['b'], 'label.b')).resolves.toEqual({ count: 1 });

    expect(mocks.query).toHaveBeenCalledWith(db, 'SELECT 1', ['a'], { label: 'label.a' });
    expect(mocks.queryFirst).toHaveBeenCalledWith(db, 'SELECT 2', ['b'], { label: 'label.b' });
  });

  it('builds profit SQL with line-aware purchase item joins', async () => {
    const repo = new OrderStatsRepository({});
    mocks.queryFirst.mockResolvedValueOnce({
      total_revenue: 200,
      total_cost: 120,
      orders_with_cost: 1,
      total_orders: 1,
    });

    await repo.getProfitSummary();

    const [, sql, params, options] = mocks.queryFirst.mock.calls[0];
    expect(params).toEqual([]);
    expect(options).toEqual({ label: 'order.stats.profitSummary' });
    expect(sql).toContain('poi.order_line_id = ol.id');
    expect(sql).toContain('poi.order_line_id IS NULL');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('modern_poi.order_line_id = ol.id');
    expect(sql).toContain('poi.pre_order_id = ol.order_id');
    expect(sql).toContain('poi.product_id = ol.product_id');
  });

  it('maps recent pending orders with parsed names and defaults the limit', async () => {
    const repo = new OrderStatsRepository({});
    mocks.query.mockResolvedValueOnce({
      results: [
        {
          id: 'order-1',
          order_no: 'SO-1',
          current_data: '{"name":"Alice"}',
          created_at: 123,
          status: 'pending',
        },
      ],
    });

    await expect(repo.getRecentPending()).resolves.toEqual([
      {
        id: 'order-1',
        orderNo: 'SO-1',
        name: 'Alice',
        createdAt: 123,
        status: 'pending',
      },
    ]);
    const [, sql, params, options] = mocks.query.mock.calls[0];
    expect(sql).toContain('archived_at IS NULL');
    expect(sql).toContain("status = 'pending'");
    expect(params).toEqual([5]);
    expect(options).toEqual({ label: 'order.stats.recentPending' });
  });

  it('returns zero-safe counts for individual count helpers', async () => {
    const repo = new OrderStatsRepository({});
    mocks.queryFirst
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ count: 2 });

    await expect(repo.countCreatedAfter(100)).resolves.toBe(4);
    await expect(repo.countByStatus('pending')).resolves.toBe(0);
    await expect(repo.countCreatedBetween(100, 200)).resolves.toBe(2);

    expect(mocks.queryFirst).toHaveBeenNthCalledWith(
      1,
      {},
      expect.stringContaining('created_at >= ?'),
      [100],
      { label: 'order.stats.countCreatedAfter' }
    );
    expect(mocks.queryFirst).toHaveBeenNthCalledWith(
      2,
      {},
      expect.stringContaining('status = ?'),
      ['pending'],
      { label: 'order.stats.countByStatus' }
    );
    expect(mocks.queryFirst).toHaveBeenNthCalledWith(
      3,
      {},
      expect.stringContaining('created_at >= ? AND created_at < ?'),
      [100, 200],
      { label: 'order.stats.countCreatedBetween' }
    );
  });

  it('returns summarized salesperson stats', async () => {
    const repo = new OrderStatsRepository({});
    mocks.queryFirst
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 });

    await expect(repo.getSalesStats('sales-1', 1000)).resolves.toEqual({
      total: 10,
      today: 3,
      pending: 2,
    });
  });

  it('returns full salesperson stats with trend rows', async () => {
    const repo = new OrderStatsRepository({});
    mocks.queryFirst
      .mockResolvedValueOnce({ count: 20 })
      .mockResolvedValueOnce({ count: 9 })
      .mockResolvedValueOnce({ count: 4 });
    mocks.query.mockResolvedValueOnce({
      results: [{ date: '2026-04-18', count: 4 }],
    });

    await expect(repo.getSalesFullStats('sales-1', 1000)).resolves.toEqual({
      total: 20,
      completed: 9,
      month: 4,
      trend: [{ date: '2026-04-18', count: 4 }],
    });
    expect(mocks.query).toHaveBeenCalledWith(
      {},
      expect.stringContaining("GROUP BY DATE(created_at / 1000, 'unixepoch', '+8 hours')"),
      ['sales-1', 1000],
      { label: 'order.stats.salesFull.trend' }
    );
  });

  it('builds admin stats distributions and delivery summary counters', async () => {
    const repo = new OrderStatsRepository({});
    mocks.queryFirst
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 8 })
      .mockResolvedValueOnce({ count: 13 })
      .mockResolvedValueOnce({ count: 2 });
    mocks.query
      .mockResolvedValueOnce({
        results: [
          { status: 'pending', count: 5 },
          { status: 'fulfilled', count: 1 },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { status: 'delivered', count: 6 },
          { status: 'partially_returned', count: 2 },
        ],
      })
      .mockResolvedValueOnce({
        results: [{ date: '2026-04-18', count: 3 }],
      });

    await expect(repo.getAdminStats(1, 2, 3)).resolves.toEqual({
      today: 3,
      week: 8,
      month: 13,
      statusDistribution: {
        pending: 5,
        fulfilled: 1,
      },
      deliveryStatusDistribution: {
        delivered: 6,
        partially_returned: 2,
      },
      awaitingDelivery: 2,
      delivered: 6,
      partiallyReturned: 2,
      returned: 0,
      recentTrend: [{ date: '2026-04-18', count: 3 }],
    });
  });

  it('returns hourly, order, pending, and share trend rows', async () => {
    const repo = new OrderStatsRepository({});
    mocks.query
      .mockResolvedValueOnce({ results: [{ hour: '08', count: 2 }] })
      .mockResolvedValueOnce({ results: [{ date: '2026-04-12', count: 4 }] })
      .mockResolvedValueOnce({ results: [{ date: '2026-04-12', count: 1 }] })
      .mockResolvedValueOnce({ results: [{ date: '2026-04-12', count: 3 }] });

    await expect(repo.getTodayHourlyTrend(100)).resolves.toEqual([{ hour: '08', count: 2 }]);
    await expect(repo.getLast7DaysOrderTrend(200)).resolves.toEqual([
      { date: '2026-04-12', count: 4 },
    ]);
    await expect(repo.getLast7DaysPendingTrend(300)).resolves.toEqual([
      { date: '2026-04-12', count: 1 },
    ]);
    await expect(repo.getLast7DaysShareTrend(400)).resolves.toEqual([
      { date: '2026-04-12', count: 3 },
    ]);

    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      {},
      expect.stringContaining("STRFTIME('%H'"),
      [100],
      { label: 'order.stats.todayHourlyTrend' }
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      {},
      expect.stringContaining('FROM orders'),
      [200],
      { label: 'order.stats.last7DaysOrderTrend' }
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      3,
      {},
      expect.stringContaining("status = 'pending'"),
      [300],
      { label: 'order.stats.last7DaysPendingTrend' }
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      4,
      {},
      expect.stringContaining('FROM folders'),
      [400],
      { label: 'order.stats.last7DaysShareTrend' }
    );
  });
});
