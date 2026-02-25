import { describe, it, expect, vi } from 'vitest';
import { ProductVariantRepository } from '../ProductVariantRepository.js';
import { VariantAuditRepository } from '../VariantAuditRepository.js';

function createPreparedStatement(sql) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return statement;
}

describe('variant audit repositories', () => {
  it('buildAuditEvents should include create/update/archive actions', () => {
    const repo = new ProductVariantRepository({});
    const before = [
      { id: 'v1', product_id: 'p1', price: 10, status: 'active', stock_quantity: 2 },
      { id: 'v2', product_id: 'p1', price: 20, status: 'active', stock_quantity: 3 },
    ];
    const after = [
      { id: 'v1', product_id: 'p1', price: 12, status: 'active', stock_quantity: 2 },
      { id: 'v3', product_id: 'p1', price: 30, status: 'active', stock_quantity: 1 },
    ];

    const events = repo.buildAuditEvents('p1', before, after);
    expect(events.map((item) => item.action).sort()).toEqual([
      'variant_archived',
      'variant_created',
      'variant_updated',
    ]);
  });

  it('VariantAuditRepository.createBatch should insert rows with changes_json', async () => {
    const db = {
      prepare: vi.fn((sql) => createPreparedStatement(sql)),
      batch: vi.fn(async () => []),
    };
    const repo = new VariantAuditRepository(db);

    await repo.createBatch([
      {
        variant_id: 'v1',
        product_id: 'p1',
        action: 'variant_updated',
        changes: { before: { price: 10 }, after: { price: 12 } },
      },
    ]);

    expect(db.batch).toHaveBeenCalledTimes(1);
    const stmt = db.batch.mock.calls[0][0][0];
    expect(stmt.sql).toContain('INSERT INTO variant_audit_logs');
    expect(typeof stmt.params[5]).toBe('string');
  });
});
