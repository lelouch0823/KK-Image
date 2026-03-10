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
  return {
    prepare: vi.fn((sql) => createPreparedStatement(sql)),
    batch: vi.fn(async () => []),
  };
}

describe('ProductVariantRepository syncVariants stock upsert behavior', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = createMockDb();
    repo = new ProductVariantRepository(db);
  });

  it('does not overwrite stock_quantity in upsert update clause for existing variants', async () => {
    await repo.syncVariants('p-1', [
      {
        id: 'v-1',
        sku: 'SKU-1',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 2,
        options_values: { color: 'black' },
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('ON CONFLICT(id) DO UPDATE SET'));
    expect(upsertStmt.sql).not.toContain('stock_quantity = excluded.stock_quantity');
  });

  it('keeps stock_quantity on insert bindings for new variants', async () => {
    await repo.syncVariants('p-1', [
      {
        id: 'v-2',
        sku: 'SKU-2',
        price: 120,
        cost_price: 70,
        stock_quantity: 9,
        alert_threshold: 3,
        options_values: { color: 'white' },
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.params).toContain(9);
  });
});
