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

function createMockDbWithExistingVariant(existingRows = []) {
  return {
    prepare: vi.fn((sql) => {
      const stmt = createPreparedStatement(sql);
      if (sql.includes('SELECT id, variant_signature, status FROM product_variants WHERE product_id = ?')) {
        stmt.all.mockResolvedValue({ results: existingRows });
      }
      return stmt;
    }),
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

  it('updates stock_quantity in upsert update clause for existing variants', async () => {
    db = createMockDbWithExistingVariant([
      { id: 'v-1', variant_signature: '{"color":"black"}', status: 'active' },
    ]);
    repo = new ProductVariantRepository(db);

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
    expect(upsertStmt.sql).toContain('stock_quantity = excluded.stock_quantity');
    const balanceStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO inventory_balances'));
    expect(balanceStmt).toBeDefined();
    expect(balanceStmt.params).toContain('v-1');
    expect(balanceStmt.params).toContain(5);
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

  it('seeds inventory_balances for newly inserted variants', async () => {
    await repo.createBatch('p-1', [
      {
        id: 'v-3',
        sku: 'SKU-3',
        price: 88,
        cost_price: 44,
        stock_quantity: 10,
        alert_threshold: 2,
        status: 'active',
        options_values: { color: 'red' },
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const balanceStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO inventory_balances'));
    expect(balanceStmt).toBeDefined();
    expect(balanceStmt.params).toContain('v-3');
    expect(balanceStmt.params).toContain(10);
  });

  it('keeps the same row id when an existing variant changes signature', async () => {
    db = createMockDbWithExistingVariant([
      { id: 'v-1', variant_signature: JSON.stringify({ 'dim-color': 'Red', 'dim-size': 'S' }), status: 'active' },
    ]);
    repo = new ProductVariantRepository(db);

    await repo.syncVariants('p-1', [
      {
        id: 'v-1',
        sku: 'SKU-1',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 2,
        options_values: { 'dim-color': 'Red' },
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.params[0]).toBe('v-1');
    expect(upsertStmt.params[8]).toBe(JSON.stringify({ 'dim-color': 'Red' }));
  });
});
