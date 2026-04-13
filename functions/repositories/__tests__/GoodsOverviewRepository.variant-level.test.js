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
      stock_quantity: 7,
      on_hand: 7,
      reserved: 2,
      available: 3,
      alert_threshold: 2,
      images: '[]',
      confirmed_qty: 2,
      production_qty: 0,
      shipping_qty: 0,
      arrived_qty: 0,
      total_demand: 2,
      order_count: 1,
      order_ids: 'o-1',
      shortage: -1,
      avg_unit_cost: 1,
      avg_freight: 0.2,
      avg_tariff: 0.1,
    }]);

    const repo = new GoodsOverviewRepository(db);
    const list = await repo.getList({ sort: 'shortage' });

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('ol.variant_id');
    expect(sql).toContain('FROM order_lines ol');
    expect(sql).toContain('JOIN orders o ON o.id = ol.order_id');
    expect(sql).toContain('GROUP BY ol.variant_id');
    expect(sql).toContain('MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0)');
    expect(sql).toContain('inventory_balances');
    expect(list[0].id).toBe('var-1');
    expect(list[0].productId).toBe('prod-1');
    expect(list[0].productCode).toBe('P0001');
    expect(list[0].variantCode).toBe('V0001');
    expect(list[0].stockQuantity).toBe(7);
    expect(list[0].shortage).toBe(-1);
    expect(list[0].orderIds).toEqual(['o-1']);
  });

  it('builds summary from order_lines remaining demand instead of order headers', async () => {
    const summaryStmt = {
      bind: vi.fn(() => summaryStmt),
      all: vi.fn(async () => ({
        results: [{
          total_products: 1,
          total_demand: 2,
          confirmed_products: 1,
          production_products: 0,
          shipping_products: 0,
          arrived_products: 0,
          confirmed_qty: 2,
          production_qty: 0,
          shipping_qty: 0,
          arrived_qty: 0,
          confirmed_orders: 1,
          production_orders: 0,
          shipping_orders: 0,
          arrived_orders: 0,
        }],
      })),
    };
    const shortageStmt = {
      bind: vi.fn(() => shortageStmt),
      all: vi.fn(async () => ({ results: [{ count: 1 }] })),
    };
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(summaryStmt)
        .mockReturnValueOnce(shortageStmt),
    };

    const repo = new GoodsOverviewRepository(db);
    const summary = await repo.getSummary();

    expect(db.prepare.mock.calls[0][0]).toContain('FROM order_lines ol');
    expect(db.prepare.mock.calls[0][0]).toContain('JOIN orders o ON o.id = ol.order_id');
    expect(db.prepare.mock.calls[0][0]).toContain('MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0)');
    expect(db.prepare.mock.calls[0][0]).toContain("COUNT(DISTINCT CASE WHEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) > 0 THEN ol.variant_id END)");
    expect(summary.totalDemand).toBe(2);
    expect(summary.shortageCount).toBe(1);
  });

  it('builds available filters from order_lines-backed active demand', async () => {
    const categoryStmt = {
      bind: vi.fn(() => categoryStmt),
      all: vi.fn(async () => ({ results: [{ category: 'Top' }] })),
    };
    const brandStmt = {
      bind: vi.fn(() => brandStmt),
      all: vi.fn(async () => ({ results: [{ brand: 'KK' }] })),
    };
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(categoryStmt)
        .mockReturnValueOnce(brandStmt),
    };

    const repo = new GoodsOverviewRepository(db);
    const filters = await repo.getAvailableFilters();

    expect(db.prepare.mock.calls[0][0]).toContain('FROM order_lines ol');
    expect(db.prepare.mock.calls[0][0]).toContain('JOIN orders o ON o.id = ol.order_id');
    expect(db.prepare.mock.calls[0][0]).toContain('MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) > 0');
    expect(db.prepare.mock.calls[1][0]).toContain('FROM order_lines ol');
    expect(db.prepare.mock.calls[1][0]).toContain('JOIN orders o ON o.id = ol.order_id');
    expect(db.prepare.mock.calls[1][0]).toContain('MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) > 0');
    expect(filters).toEqual({
      categories: ['Top'],
      brands: ['KK'],
    });
  });
  it('keeps archived-demand variants in the overview when confirmed order demand still exists', async () => {
    const all = vi.fn(async () => ({
      results: [{
        id: 'variant-archived',
        product_id: 'product-1',
        product_code: 'P001',
        variant_code: 'V001',
        name: 'Archived Tee',
        sku: 'TEE-ARCHIVED',
        brand: 'KK',
        category: 'tops',
        stock_quantity: 1,
        on_hand: 1,
        reserved: 0,
        available: 1,
        alert_threshold: 5,
        variant_options: '{"Color":"Red"}',
        images: '[]',
        confirmed_qty: 6,
        production_qty: 0,
        shipping_qty: 0,
        arrived_qty: 0,
        total_demand: 6,
        order_count: 1,
        shortage: 5,
      }],
    }));
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ all })) })),
    };

    const repo = new GoodsOverviewRepository(db);
    const list = await repo.getList({ sort: 'shortage' });
    const listSql = db.prepare.mock.calls[0][0];

    expect(listSql).not.toContain("pv.status = 'active'");
    expect(list[0]).toEqual(expect.objectContaining({
      variantId: 'variant-archived',
      totalDemand: 6,
      availableQuantity: 1,
      shortage: 5,
    }));
  });

  it('keeps available brand and category filters when historical demand remains but live variant rows are gone', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => {
            if (sql.includes('SELECT DISTINCT COALESCE(') && sql.includes(' as category')) {
              return {
                results: sql.includes('JOIN product_variants pv')
                  ? []
                  : [{ category: 'Top' }],
              };
            }
            if (sql.includes('SELECT DISTINCT COALESCE(') && sql.includes(' as brand')) {
              return {
                results: sql.includes('JOIN product_variants pv')
                  ? []
                  : [{ brand: 'KK' }],
              };
            }
            return { results: [] };
          }),
        })),
      })),
    };

    const repo = new GoodsOverviewRepository(db);
    const filters = await repo.getAvailableFilters();
    const sqlCalls = db.prepare.mock.calls.map((call) => call[0]);

    expect(sqlCalls.some((sql) => sql.includes('SELECT DISTINCT COALESCE(') && sql.includes(' as category'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('SELECT DISTINCT COALESCE('))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("json_extract(ol.snapshot_specs, '$.brand')"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("json_extract(ol.snapshot_specs, '$.category')"))).toBe(true);
    expect(filters).toEqual({
      categories: ['Top'],
      brands: ['KK'],
    });
  });

  it('falls back to order-line snapshots in overview list when live product rows are gone', async () => {
    const db = createMockDb([{
      id: 'variant-deleted',
      product_id: 'product-deleted',
      product_code: null,
      variant_code: null,
      name: 'Snapshot Tee',
      sku: 'SNAPSHOT-SKU',
      brand: 'Snapshot Brand',
      category: 'Archive Outerwear',
      stock_quantity: 0,
      on_hand: 0,
      reserved: 0,
      available: 0,
      alert_threshold: 10,
      variant_options: '{"category":"Archive Outerwear","color":"Black","size":"L","material":"Canvas"}',
      images: '["snapshot-image"]',
      confirmed_qty: 4,
      production_qty: 0,
      shipping_qty: 0,
      arrived_qty: 0,
      total_demand: 4,
      order_count: 1,
      order_ids: 'o-deleted',
      shortage: 4,
      avg_unit_cost: 0,
      avg_freight: 0,
      avg_tariff: 0,
    }]);

    const repo = new GoodsOverviewRepository(db);
    const list = await repo.getList({ sort: 'shortage' });
    const sql = db.prepare.mock.calls[0][0];

    expect(sql).toContain('snapshot_name');
    expect(sql).toContain('snapshot_sku');
    expect(sql).toContain("json_extract(ol.snapshot_specs, '$.brand')");
    expect(sql).toContain("json_extract(ol.snapshot_specs, '$.category')");
    expect(sql).toContain("json_extract(o.current_data, '$.category')");
    expect(sql).toContain("json_extract(o.original_data, '$.category')");
    expect(sql).toContain('snapshot_image');
    expect(sql).toContain('snapshot_specs');
    expect(list[0]).toEqual(expect.objectContaining({
      variantId: 'variant-deleted',
      name: 'Snapshot Tee',
      sku: 'SNAPSHOT-SKU',
      brand: 'Snapshot Brand',
      category: 'Archive Outerwear',
      variantLabel: 'Black / Canvas / L',
      images: ['snapshot-image'],
      orderIds: ['o-deleted'],
      shortage: 4,
    }));
  });

});
