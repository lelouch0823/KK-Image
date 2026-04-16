import { describe, expect, it, vi } from 'vitest';
import { OrderStatsRepository } from '../OrderStatsRepository.js';

describe('OrderStatsRepository', () => {
  it('falls back to empty names when current_data is invalid json in recent pending orders', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [
              {
                id: 'order-1',
                order_no: 'SO-1',
                current_data: '{',
                created_at: 123,
                status: 'pending',
              },
            ],
          })),
        })),
      })),
    };
    const repo = new OrderStatsRepository(db);

    await expect(repo.getRecentPending(5)).resolves.toEqual([
      {
        id: 'order-1',
        orderNo: 'SO-1',
        name: '',
        createdAt: 123,
        status: 'pending',
      },
    ]);
  });

  it('reads admin delivery stats from order_summary_projection instead of runtime line aggregation', async () => {
    const responses = [
      { type: 'first', value: { count: 3 } },
      { type: 'first', value: { count: 8 } },
      { type: 'first', value: { count: 13 } },
      { type: 'all', value: { results: [{ status: 'pending', count: 2 }] } },
      { type: 'all', value: { results: [{ status: 'delivered', count: 5 }] } },
      { type: 'first', value: { count: 1 } },
      { type: 'all', value: { results: [{ date: '2026-04-16', count: 3 }] } },
    ];
    const db = {
      prepare: vi.fn((sql) => {
        const response = responses.shift();
        const stmt = {
          bind: vi.fn(() => stmt),
          first: vi.fn(async () => response?.value),
          all: vi.fn(async () => response?.value),
        };
        stmt.sql = sql;
        return stmt;
      }),
    };
    const repo = new OrderStatsRepository(db);

    const result = await repo.getAdminStats(1, 2, 3);

    expect(db.prepare.mock.calls[4][0]).toContain('order_summary_projection');
    expect(db.prepare.mock.calls[4][0]).toContain('effective_delivery_status');
    expect(db.prepare.mock.calls[4][0]).not.toContain('FROM order_lines');
    expect(db.prepare.mock.calls[4][0]).not.toContain('order_line_agg');
    expect(db.prepare.mock.calls[5][0]).toContain('order_summary_projection');
    expect(db.prepare.mock.calls[5][0]).toContain("effective_delivery_status = 'in_transit'");
    expect(db.prepare.mock.calls[5][0]).not.toContain('FROM order_lines');
    expect(db.prepare.mock.calls[5][0]).not.toContain('order_line_agg');
    expect(result).toEqual(expect.objectContaining({
      today: 3,
      week: 8,
      month: 13,
      awaitingDelivery: 1,
      delivered: 5,
    }));
  });
});
