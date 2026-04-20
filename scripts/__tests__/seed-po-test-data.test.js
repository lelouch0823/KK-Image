import { describe, expect, it, vi } from 'vitest';
import { buildSeedSql, createSeedPoTestDataRunner } from '../seed-po-test-data-lib.mjs';

describe('seed-po-test-data-lib', () => {
  it('builds deterministic seed sql when uuid, random and time are injected', () => {
    const uuids = ['p1', 'p2', 'o1', 'o2', 'o3', 'o4'];
    const randomValues = [0, 1, 10, 20, 1, 0, 2, 5, 3, 2, 4, 8];
    const sql = buildSeedSql({
      productCount: 2,
      nowImpl: () => 1710000000000,
      uuidImpl: () => uuids.shift() || 'fallback-id',
      randomIntImpl: () => randomValues.shift() ?? 1,
    });

    expect(sql).toContain('INSERT OR IGNORE INTO salespersons');
    expect(sql).toContain("VALUES ('p1', 'Test Product 1'");
    expect(sql).toContain("VALUES ('p2', 'Test Product 2'");
    expect(sql).toContain('INSERT INTO orders');
    expect(sql.match(/INSERT INTO products/g)).toHaveLength(2);
  });

  it('writes the generated sql to the requested output path', () => {
    const fsModule = { writeFileSync: vi.fn() };
    const consoleImpl = { log: vi.fn() };
    const runner = createSeedPoTestDataRunner({
      fsModule,
      consoleImpl,
      outputPath: 'tmp/seed.sql',
      productCount: 1,
      nowImpl: () => 1710000000000,
      uuidImpl: (() => {
        const ids = ['product-1', 'order-1'];
        return () => ids.shift() || 'extra-id';
      })(),
      randomIntImpl: () => 1,
    });

    const sql = runner.main();

    expect(fsModule.writeFileSync).toHaveBeenCalledWith('tmp/seed.sql', sql, 'utf8');
    expect(consoleImpl.log).toHaveBeenCalledWith('Successfully generated tmp/seed.sql');
  });
});
