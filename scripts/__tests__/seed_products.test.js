import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/seed_products.js');

async function importScript() {
  return import(`${pathToFileURL(SCRIPT_PATH).href}?t=${Date.now()}-${Math.random()}`);
}

function createDeterministicDeps(overrides = {}) {
  let idCounter = 0;
  return {
    now: () => 1_710_000_000_000,
    id: () => `id-${idCounter += 1}`,
    pick: (arr, index) => arr[index % arr.length],
    tempFileName: () => 'seed-products.sql',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seed_products import contract', () => {
  it('can be imported without auto-running and exposes reusable helpers', () => {
    const scriptUrl = pathToFileURL(SCRIPT_PATH).href;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const mod = await import(${JSON.stringify(scriptUrl)}); console.log(JSON.stringify(Object.keys(mod).sort()));`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('runSeedProductsCli');
    expect(result.stdout).toContain('buildSeedRows');
    expect(result.stdout).toContain('buildSQL');
  });
});

describe('seed_products helpers', () => {
  it('parses remote binding config and escapes sql text', async () => {
    const mod = await importScript();

    expect(mod.parseSeedProductsArgs(['--remote'])).toEqual({
      totalProducts: 50,
      dbBinding: 'DB --remote',
    });
    expect(mod.parseSeedProductsArgs([])).toEqual({
      totalProducts: 50,
      dbBinding: 'DB --local',
    });
    expect(mod.esc("O'Hara")).toBe("O''Hara");
  });

  it('builds dimension groups, cartesian options, and variant sku values', async () => {
    const mod = await importScript();

    expect(mod.makeDimensions(0)).toEqual([
      { name: '颜色', values: ['黑', '白'] },
      { name: '材质', values: ['棉', '涤纶'] },
      { name: '尺码', values: ['S', 'M', 'L'] },
    ]);
    expect(mod.makeDimensions(1)).toEqual([
      { name: '颜色', values: ['白', '蓝', '军绿'] },
      { name: '尺码', values: ['M', 'L', 'XL'] },
    ]);
    expect(mod.makeDimensions(2)).toEqual([
      { name: '颜色', values: ['黄', '军绿', '白'] },
    ]);

    expect(
      mod.cartesianOptions([
        { name: '颜色', values: ['黑', '白'] },
        { name: '尺码', values: ['S', 'M'] },
      ])
    ).toEqual([
      { 颜色: '黑', 尺码: 'S' },
      { 颜色: '黑', 尺码: 'M' },
      { 颜色: '白', 尺码: 'S' },
      { 颜色: '白', 尺码: 'M' },
    ]);

    expect(mod.buildSku('P-SEED-0001', { 颜色: '黑色', 尺码: 'XL' }, 2)).toBe(
      'P-SEED-0001-黑色-XL-003'
    );
  });

  it('builds deterministic seed rows and sql statements', async () => {
    const mod = await importScript();
    const rows = mod.buildSeedRows(
      { totalProducts: 2, dbBinding: 'DB --local' },
      createDeterministicDeps()
    );

    expect(rows.products).toHaveLength(2);
    expect(rows.files.length).toBeGreaterThan(0);
    expect(rows.variants.length).toBeGreaterThan(0);
    expect(rows.products[0]).toMatchObject({
      id: 'id-1',
      brand: 'Aster',
      category: 'T-Shirt',
      product_code: 'P-SEED-0001',
    });
    expect(rows.variants[0]).toMatchObject({
      product_id: 'id-1',
      image_id: 'id-2',
      variant_code: 'V-SEED-0001-001',
      supplier_sku: 'P-SEED-0001-SUP-001',
    });

    const sql = mod.buildSQL(rows);
    expect(sql).toContain('BEGIN TRANSACTION;');
    expect(sql).toContain('INSERT INTO files');
    expect(sql).toContain('INSERT INTO products');
    expect(sql).toContain('INSERT INTO product_variants');
    expect(sql).toContain('COMMIT;');
  });

  it('writes sql to a temp file, executes wrangler, and always cleans up', async () => {
    const mod = await importScript();
    const writeFileSyncImpl = vi.fn();
    const unlinkSyncImpl = vi.fn();
    const execSyncImpl = vi.fn();

    expect(
      mod.executeSQL('SELECT 1', {
        config: { totalProducts: 50, dbBinding: 'DB --local' },
        deps: createDeterministicDeps(),
        cwd: '/repo',
        pathModule: path,
        writeFileSyncImpl,
        unlinkSyncImpl,
        execSyncImpl,
      })
    ).toBe('/repo/seed-products.sql');

    expect(writeFileSyncImpl).toHaveBeenCalledWith('/repo/seed-products.sql', 'SELECT 1', 'utf8');
    expect(execSyncImpl).toHaveBeenCalledWith(
      'npx wrangler d1 execute DB --local --file="/repo/seed-products.sql"',
      { stdio: 'inherit' }
    );
    expect(unlinkSyncImpl).toHaveBeenCalledWith('/repo/seed-products.sql');

    expect(() =>
      mod.executeSQL('SELECT 2', {
        config: { totalProducts: 50, dbBinding: 'DB --remote' },
        deps: createDeterministicDeps(),
        cwd: '/repo',
        pathModule: path,
        writeFileSyncImpl: vi.fn(),
        unlinkSyncImpl,
        execSyncImpl: vi.fn(() => {
          throw new Error('boom');
        }),
      })
    ).toThrow('boom');
    expect(unlinkSyncImpl).toHaveBeenCalledWith('/repo/seed-products.sql');
  });

  it('verifies product and variant counts through wrangler json queries', async () => {
    const mod = await importScript();
    const outputs = [];
    const execSyncImpl = vi
      .fn()
      .mockReturnValueOnce(Buffer.from('[{"results":[{"c":50}]}]'))
      .mockReturnValueOnce(Buffer.from('[{"results":[{"c":405}]}]'));

    const result = mod.verifySeed(
      { totalProducts: 50, dbBinding: 'DB --local' },
      {
        execSyncImpl,
        writeLine: (line) => outputs.push(line),
      }
    );

    expect(result.productCount).toContain('"c":50');
    expect(result.variantCount).toContain('"c":405');
    expect(outputs.join('\n')).toContain('Products check:');
    expect(outputs.join('\n')).toContain('Variants check:');
  });
});

describe('seed_products cli runner', () => {
  it('orchestrates row generation, sql building, execution, and verification', async () => {
    const mod = await importScript();
    const buildSeedRowsImpl = vi.fn(() => ({ files: [], products: [], variants: [] }));
    const buildSQLImpl = vi.fn(() => 'SELECT 1');
    const executeSQLImpl = vi.fn();
    const verifySeedImpl = vi.fn();
    const outputs = [];

    const exitCode = await mod.runSeedProductsCli({
      config: { totalProducts: 12, dbBinding: 'DB --local' },
      deps: createDeterministicDeps(),
      buildSeedRowsImpl,
      buildSQLImpl,
      executeSQLImpl,
      verifySeedImpl,
      writeLine: (line) => outputs.push(line),
    });

    expect(exitCode).toBe(0);
    expect(buildSeedRowsImpl).toHaveBeenCalledTimes(1);
    expect(buildSQLImpl).toHaveBeenCalledWith({ files: [], products: [], variants: [] });
    expect(executeSQLImpl).toHaveBeenCalledWith('SELECT 1');
    expect(verifySeedImpl).toHaveBeenCalledWith({ totalProducts: 12, dbBinding: 'DB --local' });
    expect(outputs.join('\n')).toContain('Seed complete: 12 multi-spec products inserted.');
  });
});
