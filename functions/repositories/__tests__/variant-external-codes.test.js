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
    all: vi.fn(),
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
    const upsertStmt = statements[1];
    expect(upsertStmt.sql).toContain('barcode');
    expect(upsertStmt.sql).toContain('supplier_sku');
    expect(upsertStmt.sql).toContain('variant_signature');
    expect(upsertStmt.params).toContain('6923450657713');
    expect(upsertStmt.params).toContain('SUP-TEE-Y-S');
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
});
