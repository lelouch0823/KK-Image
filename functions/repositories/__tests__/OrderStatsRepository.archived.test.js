import { describe, expect, it, vi } from 'vitest';
import { OrderStatsRepository } from '../OrderStatsRepository.js';

function createDb() {
  const sqlCalls = [];
  return {
    sqlCalls,
    prepare: vi.fn((sql) => {
      sqlCalls.push(String(sql || ''));
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => ({ count: 0 })),
        all: vi.fn(async () => ({ results: [] })),
      };
      return statement;
    }),
  };
}

function orderSqlCalls(db) {
  return db.sqlCalls.filter((sql) => /\bFROM\s+orders\b/i.test(sql));
}

describe('OrderStatsRepository archived order filtering', () => {
  it('excludes archived orders from salesperson and admin order statistics', async () => {
    const db = createDb();
    const repo = new OrderStatsRepository(db);

    await repo.getSalesStats('sales-1', 1710000000000);
    await repo.getSalesFullStats('sales-1', 1710000000000);
    await repo.getAdminStats(1710000000000, 1709400000000, 1708000000000);

    for (const sql of orderSqlCalls(db)) {
      expect(sql).toContain('archived_at IS NULL');
    }
  });

  it('excludes archived orders from trend, ranking, and profit statistics', async () => {
    const db = createDb();
    const repo = new OrderStatsRepository(db);

    await repo.getTodayHourlyTrend(1710000000000);
    await repo.getLast7DaysOrderTrend(1710000000000);
    await repo.getLast7DaysPendingTrend(1710000000000);
    await repo.getSalesTrend(1710000000000);
    await repo.getStatusDistribution();
    await repo.getTopProducts();
    await repo.getSalespersonStats();
    await repo.getProfitSummary(1710000000000);
    await repo.getProfitTrend(1710000000000);
    await repo.getProfitByProduct();

    for (const sql of orderSqlCalls(db)) {
      expect(sql).toContain('archived_at IS NULL');
    }
  });
});
