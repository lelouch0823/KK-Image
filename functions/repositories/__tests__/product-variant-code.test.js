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

describe('ProductVariantRepository — variant_code', () => {
  let db;
  let repo;

  beforeEach(() => {
    ({ db } = createMockDb());
    repo = new ProductVariantRepository(db);
  });

  it('createBatch 应返回数据库生成的 variant_code', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      return stmt;
    });

    // 应用层计算 variant_code（与数据库 trigger trg_variants_generate_variant_code 一致）
    const rows = await repo.createBatch('product-1', [{ id: 'variant-1', sku: 'SKU-1' }]);
    expect(rows[0].variant_code).toBe('VVARIANT1');
  });

  it('createBatch 在空 sku 时应自动生成非空 sku', async () => {
    db.prepare.mockImplementation((sql) => {
      const stmt = createPreparedStatement(sql);
      if (sql.includes('FROM product_variants pv') && sql.includes('WHERE pv.product_id = ?')) {
        stmt.all.mockResolvedValue({
          results: [
            {
              id: 'variant-empty',
              product_id: 'product-1',
              sku: 'SKU-VARIANTE',
              variant_code: 'VVARIANTE0001',
              options_values: '{}',
            },
          ],
        });
      }
      return stmt;
    });

    await repo.createBatch('product-1', [{ id: 'variant-empty', sku: '' }]);
    const batchStatements = db.batch.mock.calls[0][0];
    const insertStmt = batchStatements[0];
    expect(insertStmt.params[2]).toMatch(/^SKU-/);
    expect(insertStmt.params[2]).not.toBe('');
  });

  it('buildVariantSignature 应对 options key 稳定排序', () => {
    const signature = repo.buildVariantSignature({ b: '2', a: '1' });
    expect(signature).toBe(JSON.stringify({ a: '1', b: '2' }));
  });
});
