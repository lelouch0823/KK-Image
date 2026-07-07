import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../../lib/db/query.js', () => ({
  query: (...args) => mocks.query(...args),
}));

import { ProfitRepository } from '../ProfitRepository.js';

describe('ProfitRepository purchase-order item joins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({ results: [] });
  });

  it('prefers purchase_order_items.order_line_id and only falls back to composite legacy joins', async () => {
    const repo = new ProfitRepository({});

    await repo.findOrderLinesForProfit('order-1');

    const [, sql, params, options] = mocks.query.mock.calls[0];
    expect(params).toEqual(['order-1']);
    expect(options).toEqual({ label: 'profit.order.lines' });
    expect(sql).toContain('poi.order_line_id = ol.id');
    expect(sql).toContain('poi.order_line_id IS NULL');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('modern_poi.order_line_id = ol.id');
    expect(sql).toContain('poi.pre_order_id = ol.order_id');
    expect(sql).toContain('poi.product_id = ol.product_id');
    expect(sql).toContain(
      'poi.variant_id = ol.variant_id OR (poi.variant_id IS NULL AND ol.variant_id IS NULL)'
    );
  });

  it('uses the same line-aware purchase item join for summary, product, and trend profit queries', async () => {
    const repo = new ProfitRepository({});

    await repo.findOrderLinesForProfitSummary();
    await repo.findOrderLinesForProfitByProduct();
    await repo.findOrderLinesForProfitTrend(1000);

    for (const call of mocks.query.mock.calls) {
      const sql = call[1];
      expect(sql).toContain('poi.order_line_id = ol.id');
      expect(sql).toContain('poi.order_line_id IS NULL');
      expect(sql).toContain('modern_poi.order_line_id = ol.id');
    }
  });
});
