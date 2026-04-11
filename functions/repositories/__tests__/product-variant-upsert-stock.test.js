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
    batchCalls: [],
    batch: vi.fn(async function batch(statements = []) {
      this.batchCalls.push(statements);
      return [];
    }),
  };
}

function createMockDbWithExistingVariant(existingRows = []) {
  return {
    prepare: vi.fn((sql) => {
      const stmt = createPreparedStatement(sql);
      if (sql.includes('SELECT')) {
        stmt.all.mockResolvedValue({ results: existingRows });
      }
      return stmt;
    }),
    batchCalls: [],
    batch: vi.fn(async function batch(statements = []) {
      this.batchCalls.push(statements);
      return [];
    }),
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

  it('preserves existing stock bindings when an existing variant omits stock_quantity', async () => {
    db = createMockDbWithExistingVariant([
      {
        id: 'v-keep-stock',
        variant_signature: '{"color":"navy"}',
        status: 'active',
        stock_quantity: 12,
        on_hand: 12,
        reserved: 4,
      },
    ]);
    repo = new ProductVariantRepository(db);

    await repo.syncVariants('p-1', [
      {
        id: 'v-keep-stock',
        sku: 'SKU-KEEP',
        price: 100,
        cost_price: 60,
        alert_threshold: 2,
        options_values: { color: 'navy' },
        status: 'active',
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    const balanceStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO inventory_balances'));
    expect(upsertStmt.params).toContain(12);
    expect(balanceStmt.params).toContain(12);
    expect(upsertStmt.params).not.toContain(0);
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

  it('preserves alert_threshold=0 when inserting new variants', async () => {
    await repo.createBatch('p-1', [
      {
        id: 'v-zero-alert',
        sku: 'SKU-ZERO',
        price: 88,
        cost_price: 44,
        stock_quantity: 10,
        alert_threshold: 0,
        status: 'active',
        options_values: { color: 'red' },
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.params[6]).toBe(0);
  });

  it('preserves alert_threshold=0 when syncing existing variants', async () => {
    db = createMockDbWithExistingVariant([
      { id: 'v-zero-alert', variant_signature: '{"color":"black"}', status: 'active', stock_quantity: 5 },
    ]);
    repo = new ProductVariantRepository(db);

    await repo.syncVariants('p-1', [
      {
        id: 'v-zero-alert',
        sku: 'SKU-ZERO',
        price: 100,
        cost_price: 60,
        stock_quantity: 5,
        alert_threshold: 0,
        options_values: { color: 'black' },
      },
    ]);

    const statements = db.batch.mock.calls[0][0];
    const upsertStmt = statements.find((stmt) => stmt.sql.includes('INSERT INTO product_variants'));
    expect(upsertStmt.params[6]).toBe(0);
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

  it('chunks large createBatch writes into D1-safe batch sizes', async () => {
    await repo.createBatch('p-1', Array.from({ length: 51 }, (_, index) => ({
      id: `v-batch-${index + 1}`,
      sku: `SKU-BATCH-${index + 1}`,
      price: 88,
      cost_price: 44,
      stock_quantity: 10,
      alert_threshold: 2,
      status: 'active',
      options_values: { color: `color-${index + 1}` },
    })));

    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(Math.max(...db.batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
  });

  it('chunks large syncVariants writes and avoids oversized archive bindings', async () => {
    db = createMockDbWithExistingVariant(Array.from({ length: 120 }, (_, index) => ({
      id: `v-existing-${index + 1}`,
      variant_signature: JSON.stringify({ color: `color-${index + 1}` }),
      status: 'active',
    })));
    repo = new ProductVariantRepository(db);

    await repo.syncVariants('p-1', Array.from({ length: 120 }, (_, index) => ({
      id: `v-existing-${index + 1}`,
      sku: `SKU-${index + 1}`,
      price: 100,
      cost_price: 60,
      stock_quantity: 5,
      alert_threshold: 2,
      options_values: { color: `color-${index + 1}` },
    })));

    expect(db.batch.mock.calls.length).toBeGreaterThan(1);
    expect(Math.max(...db.batchCalls.map((statements) => statements.length))).toBeLessThanOrEqual(100);
    const maxBindings = Math.max(...db.batchCalls.flatMap((statements) => statements.map((statement) => statement.params.length)));
    expect(maxBindings).toBeLessThanOrEqual(100);
  });
});
