import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductVariantRepository } from '../ProductVariantRepository.js';

function createPreparedStatement(sql) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(),
  };
  return statement;
}

function createMockDb() {
  const db = {
    prepare: vi.fn((sql) => createPreparedStatement(sql)),
    batch: vi.fn(async () => []),
  };
  return { db };
}

function isVariantLookupSql(sql) {
  return sql.includes('FROM product_variants pv') && sql.includes('pv.variant_signature');
}

describe('ProductVariantRepository external codes', () => {
  let db;
  let repo;

  beforeEach(() => {
    ({ db } = createMockDb());
    repo = new ProductVariantRepository(db);
  });

  it('syncVariants should write barcode and supplier_sku columns', async () => {
    await repo.syncVariants('product-1', [{
      id: 'variant-1',
      sku: 'SKU-1',
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Yellow' },
      status: 'active',
      barcode: '6923450657713',
      supplier_sku: 'SUP-TEE-Y-S',
    }]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.sql).toContain('barcode');
    expect(upsertStmt.sql).toContain('supplier_sku');
    expect(upsertStmt.sql).toContain('variant_signature');
    expect(upsertStmt.params).toContain('6923450657713');
    expect(upsertStmt.params).toContain('SUP-TEE-Y-S');
  });

  it('syncVariants should update stock_quantity in the upsert update clause', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (isVariantLookupSql(sql)) {
        stmt.all.mockResolvedValue({
          results: [
            { id: 'variant-1', variant_signature: '{"color":"Yellow"}', status: 'active' },
          ],
        });
      }
      return stmt;
    });

    await repo.syncVariants('product-1', [{
      id: 'variant-1',
      sku: 'SKU-1',
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Yellow' },
      status: 'active',
    }]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.sql).toContain('stock_quantity = excluded.stock_quantity');
  });

  it('syncVariants should throw friendly error when barcode violates unique constraint', async () => {
    db.batch.mockRejectedValueOnce(new Error('UNIQUE constraint failed: product_variants.barcode'));

    await expect(repo.syncVariants('product-1', [{
      id: 'variant-1',
      sku: 'SKU-1',
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Yellow' },
      status: 'active',
      barcode: 'DUP-BARCODE',
      supplier_sku: 'SUP-1',
    }])).rejects.toThrow(/barcode/i);
  });

  it('syncVariants should throw friendly error when variant signature unique constraint fails', async () => {
    db.batch.mockRejectedValueOnce(
      new Error('UNIQUE constraint failed: product_variants.product_id, product_variants.variant_signature')
    );

    await expect(repo.syncVariants('product-1', [{
      id: 'variant-1',
      sku: 'SKU-1',
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Yellow' },
      status: 'active',
      barcode: null,
      supplier_sku: null,
    }])).rejects.toThrow(/variant signature/i);
  });

  it('syncVariants should archive removed variants instead of hard deleting', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (isVariantLookupSql(sql)) {
        stmt.all.mockResolvedValue({
          results: [
            { id: 'variant-1', variant_signature: '{"color":"Yellow"}' },
            { id: 'variant-2', variant_signature: '{"color":"Green"}' },
          ],
        });
      }
      return stmt;
    });

    await repo.syncVariants('product-1', [{
      id: 'variant-1',
      sku: 'SKU-1',
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Yellow' },
      status: 'active',
      barcode: '6923450657713',
      supplier_sku: 'SUP-TEE-Y-S',
    }]);

    const statements = db.batch.mock.calls[0][0];
    expect(statements.some((stmt) => stmt.sql.includes('DELETE FROM product_variants'))).toBe(false);
    expect(statements[0].sql).toContain("UPDATE product_variants");
    expect(statements[0].sql).toContain("SET status = 'archived'");
  });

  it('syncVariants should keep existing id when incoming signature changed for existing id', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (isVariantLookupSql(sql)) {
        stmt.all.mockResolvedValue({
          results: [
            { id: 'variant-1', variant_signature: '{"color":"Yellow"}' },
          ],
        });
      }
      return stmt;
    });

    const rows = await repo.syncVariants('product-1', [{
      id: 'variant-1',
      sku: 'SKU-1',
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Blue' },
      status: 'active',
      barcode: '6923450657713',
      supplier_sku: 'SUP-TEE-B-S',
    }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('variant-1');

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.params[0]).toBe('variant-1');
    expect(upsertStmt.params[8]).toBe('{"color":"Blue"}');
  });

  it('syncVariants should reactivate archived variant with same signature and keep id', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (isVariantLookupSql(sql)) {
        stmt.all.mockResolvedValue({
          results: [
            { id: 'variant-archived-1', variant_signature: '{"color":"Blue"}', status: 'archived' },
          ],
        });
      }
      return stmt;
    });

    const rows = await repo.syncVariants('product-1', [{
      sku: 'SKU-NEW',
      price: 20,
      cost_price: 10,
      stock_quantity: 5,
      alert_threshold: 2,
      options_values: { color: 'Blue' },
      barcode: 'REUSE-BCODE',
      supplier_sku: 'REUSE-SKU',
    }]);

    expect(rows[0].id).toBe('variant-archived-1');
  });

  it('syncVariants should expose created/updated/archived/reactivated counters', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (isVariantLookupSql(sql)) {
        stmt.all.mockResolvedValue({
          results: [
            { id: 'variant-keep', variant_signature: '{"color":"Yellow"}', status: 'active' },
            { id: 'variant-archive', variant_signature: '{"color":"Green"}', status: 'active' },
            { id: 'variant-archived-1', variant_signature: '{"color":"Blue"}', status: 'archived' },
          ],
        });
      }
      return stmt;
    });

    const rows = await repo.syncVariants('product-1', [
      {
        id: 'variant-keep',
        sku: 'SKU-KEEP',
        price: 12,
        cost_price: 8,
        stock_quantity: 3,
        alert_threshold: 1,
        options_values: { color: 'Yellow' },
      },
      {
        sku: 'SKU-REACT',
        price: 22,
        cost_price: 12,
        stock_quantity: 6,
        alert_threshold: 2,
        options_values: { color: 'Blue' },
      },
      {
        sku: 'SKU-CREATE',
        price: 30,
        cost_price: 15,
        stock_quantity: 9,
        alert_threshold: 3,
        options_values: { color: 'Black' },
      },
    ]);

    expect(rows.createdCount).toBe(1);
    expect(rows.updatedCount).toBe(1);
    expect(rows.reactivatedCount).toBe(1);
    expect(rows.archivedCount).toBe(1);
  });

  it('syncVariants should reject duplicate variant signature in same payload', async () => {
    await expect(repo.syncVariants('product-1', [
      {
        sku: 'SKU-A',
        price: 12,
        cost_price: 8,
        stock_quantity: 3,
        alert_threshold: 1,
        options_values: { color: 'Yellow' },
      },
      {
        sku: 'SKU-B',
        price: 13,
        cost_price: 9,
        stock_quantity: 2,
        alert_threshold: 1,
        options_values: { color: 'Yellow' },
      },
    ])).rejects.toThrow(/duplicate variant signature/i);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('syncVariants should allow barcode reuse when matched archived variant is not retained', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (isVariantLookupSql(sql)) {
        stmt.all.mockResolvedValue({
          results: [
            { id: 'variant-archived-old', variant_signature: '{"color":"Old"}', status: 'archived' },
          ],
        });
      }
      return stmt;
    });

    const rows = await repo.syncVariants('product-1', [
      {
        sku: 'SKU-NEW-ACTIVE',
        price: 35,
        cost_price: 18,
        stock_quantity: 7,
        alert_threshold: 2,
        options_values: { color: 'Black' },
        barcode: 'REUSE-BCODE',
        status: 'active',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe('variant-archived-old');
    expect(rows.createdCount).toBe(1);
  });

  it('syncVariants should reject empty sku instead of auto-generating one', async () => {
    await expect(repo.syncVariants('product-1', [{
      price: 12,
      cost_price: 8,
      stock_quantity: 3,
      alert_threshold: 1,
      options_values: { color: 'Yellow' },
      status: 'active',
    }])).rejects.toThrow(/sku is required/i);

    expect(db.batch).not.toHaveBeenCalled();
  });
});
