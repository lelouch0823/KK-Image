import { describe, it, expect, vi } from 'vitest';
import { GoodsOverviewRepository } from '../GoodsOverviewRepository.js';

function createMockDb(results = []) {
  const stmt = {
    bind: vi.fn(() => stmt),
    all: vi.fn(async () => ({ results })),
  };
  return {
    prepare: vi.fn(() => stmt),
    _stmt: stmt,
  };
}

describe('GoodsOverviewRepository variant-level', () => {
  it('queries and groups by variant_id for goods overview list', async () => {
    const db = createMockDb([{
      id: 'var-1',
      variant_id: 'var-1',
      product_id: 'prod-1',
      product_code: 'P0001',
      variant_code: 'V0001',
      name: 'Tee',
      sku: 'TEE-YELLOW-S',
      brand: 'KK',
      category: 'Top',
      stock_quantity: 3,
      alert_threshold: 2,
      images: '[]',
      confirmed_qty: 2,
      production_qty: 0,
      shipping_qty: 0,
      arrived_qty: 0,
      total_demand: 2,
      order_count: 1,
      shortage: -1,
      avg_unit_cost: 1,
      avg_freight: 0.2,
      avg_tariff: 0.1,
    }]);

    const repo = new GoodsOverviewRepository(db);
    const list = await repo.getList({ sort: 'shortage' });

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('o.variant_id');
    expect(sql).toContain('GROUP BY o.variant_id');
    expect(list[0].id).toBe('var-1');
    expect(list[0].productId).toBe('prod-1');
    expect(list[0].productCode).toBe('P0001');
    expect(list[0].variantCode).toBe('V0001');
  });
});
