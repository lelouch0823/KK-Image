import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderLineRepository } from '../OrderLineRepository.js';

function createMockDb() {
  return {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        bind: vi.fn(function bindStatement() {
          statement.params = Array.from(arguments);
          return statement;
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return statement;
    }),
  };
}

describe('OrderLineRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a migrated single-line order snapshot and preserves JSON specs', async () => {
    const now = 1710000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = createMockDb();
    const repo = new OrderLineRepository(db);

    await repo.create({
      id: 'line-123',
      order_id: 'order-1',
      snapshot_name: 'Radiant Shirt',
      snapshot_sku: 'RS-01',
      snapshot_specs: { color: 'red', size: 'M' },
      snapshot_image: 'https://cdn.example/radiant',
      ordered_qty: 5,
    });

    expect(db.prepare).toHaveBeenCalledTimes(1);
    expect(db.prepare.mock.results[0].value.run).toHaveBeenCalledTimes(1);
    const bindArgs = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(db.prepare.mock.calls[0][0]).toContain('INSERT INTO order_lines');
    // unit_price 占位（变体价格快照子查询）插在 variant_id 之后：索引 4 起整体后移
    expect(db.prepare.mock.calls[0][0]).toContain(
      'COALESCE(?, (SELECT price FROM product_variants WHERE id = ?))'
    );
    expect(bindArgs[0]).toBe('line-123');
    expect(bindArgs[1]).toBe('order-1');
    // R2：COALESCE(手工 unitPrice, 变体售价)——手工行 unitPrice 为 NULL，
    // 无 variant_id 时子查询参数也为 NULL，name 起整体后移至索引 6
    expect(bindArgs[4]).toBe(null);
    expect(bindArgs[5]).toBe(null);
    expect(bindArgs[6]).toBe('Radiant Shirt');
    expect(bindArgs[7]).toBe('RS-01');
    expect(bindArgs[8]).toBe(JSON.stringify({ color: 'red', size: 'M' }));
    expect(bindArgs[9]).toBe('https://cdn.example/radiant');
    expect(bindArgs[10]).toBe(5);
    expect(bindArgs[16]).toBe('unprocured');
    expect(bindArgs[17]).toBe(now);
    expect(bindArgs[18]).toBe(now);
  });
});
