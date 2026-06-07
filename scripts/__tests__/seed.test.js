import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/seed.js');

async function importScript() {
  return import(`${pathToFileURL(SCRIPT_PATH).href}?t=${Date.now()}-${Math.random()}`);
}

function createDeterministicDeps(overrides = {}) {
  let idCounter = 0;
  let hashCounter = 0;

  return {
    random: () => 0,
    now: () => 1_710_000_000_000,
    dateFactory: () => new Date('2026-04-18T08:00:00.000Z'),
    randomBytes: (size) => Buffer.alloc(size, 1),
    uuid: () => `id-${(idCounter += 1)}`,
    randomHash: () => `hash-${(hashCounter += 1)}`,
    randomInt: (min) => min,
    randomItem: (arr) => arr[0],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seed script import contract', () => {
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
    expect(result.stdout).toContain('runSeedCli');
    expect(result.stdout).toContain('generateSeedSql');
    expect(result.stdout).toContain('toSqlValue');
  });
});

describe('seed helpers', () => {
  it('parses cli args and falls back invalid counts to 50', async () => {
    const mod = await importScript();

    expect(mod.parseSeedArgs(['--remote', '--count', '12'])).toEqual({
      database: 'DB',
      remote: true,
      count: 12,
    });
    expect(mod.parseSeedArgs(['--count', 'oops'])).toEqual({
      database: 'DB',
      remote: false,
      count: 50,
    });
  });

  it('formats sql values and insert statements safely', async () => {
    const mod = await importScript();

    expect(mod.toSqlValue(null)).toBe('NULL');
    expect(mod.toSqlValue(true)).toBe('1');
    expect(mod.toSqlValue("O'Hara")).toBe("'O''Hara'");
    expect(
      mod.generateInsert('customers', {
        id: 'c1',
        name: "O'Hara",
      })
    ).toBe(`INSERT OR IGNORE INTO "customers" ("id", "name") VALUES ('c1', 'O''Hara');`);
  });

  it('writes sql batches and reports execution failures', async () => {
    const mod = await importScript();
    const writeErrors = [];
    const writeFileSyncImpl = vi.fn();
    const execSyncImpl = vi.fn(() => Buffer.from('ok'));

    expect(
      mod.executeSeedSql('SELECT 1', {
        config: { database: 'DB', remote: false },
        execSyncImpl,
        writeFileSyncImpl,
        tmpdirValue: '/tmp',
        pathModule: path,
        writeError: (line) => writeErrors.push(line),
      })
    ).toBe(true);

    expect(writeFileSyncImpl).toHaveBeenCalledWith('/tmp/seed_batch.sql', 'SELECT 1', 'utf-8');
    expect(execSyncImpl).toHaveBeenCalledWith(
      'npx wrangler d1 execute DB --local --file=/tmp/seed_batch.sql',
      { stdio: 'pipe' }
    );

    const failure = mod.executeSeedSql('SELECT 2', {
      config: { database: 'DB', remote: true },
      execSyncImpl: vi.fn(() => {
        const error = new Error('boom');
        error.stderr = Buffer.from('bad stderr');
        throw error;
      }),
      writeFileSyncImpl: vi.fn(),
      tmpdirValue: '/tmp',
      pathModule: path,
      writeError: (line) => writeErrors.push(line),
    });

    expect(failure).toBe(false);
    expect(writeErrors.join('\n')).toContain('SQL 执行失败: boom');
    expect(writeErrors.join('\n')).toContain('bad stderr');
  });

  it('generates deterministic entity payloads through injected deps', async () => {
    const mod = await importScript();
    const deps = createDeterministicDeps();

    expect(mod.generateSalesperson('sp-1', deps)).toMatchObject({
      id: 'sp-1',
      name: '张伟',
      store: '北京旗舰店',
      phone: '13810000000',
      is_active: 1,
    });

    expect(mod.generateCustomer('cu-1', deps)).toMatchObject({
      id: 'cu-1',
      company: '北京科技有限公司',
      tags: 'VIP',
    });

    expect(mod.generateFolder('fo-1', 'parent-1', deps)).toMatchObject({
      id: 'fo-1',
      parent_id: 'parent-1',
    });

    expect(mod.generateBlob('custom-hash', deps)).toMatchObject({
      content_hash: 'custom-hash',
      mime_type: 'image/jpeg',
    });

    expect(
      mod.generateFile('file-1', 'folder-1', 'http://image', mod.PRODUCT_CATEGORIES[0], deps)
    ).toMatchObject({
      id: 'file-1',
      folder_id: 'folder-1',
      storage_key: 'http://image',
      content_hash: 'http://image',
      size: 102400,
    });

    expect(mod.generateOrder('order-1', 'sp-1', 'cu-1', 'file-1', deps)).toMatchObject({
      id: 'order-1',
      salesperson_id: 'sp-1',
      customer_id: 'cu-1',
      main_image_id: 'file-1',
      status: 'pending',
    });

    expect(mod.generateOrderTimeline('tl-1', 'order-1', 'sp-1', deps)).toMatchObject({
      id: 'tl-1',
      order_id: 'order-1',
      actor_type: 'salesperson',
    });

    expect(mod.generateNotification('noti-1', deps)).toMatchObject({
      id: 'noti-1',
      type: 'system',
      link: '/manage/orders',
    });

    expect(mod.generateProduct('prod-1', deps)).toMatchObject({
      id: 'prod-1',
      brand: 'Apple',
      category: '智能数码',
      status: 'active',
      stock_quantity: 0,
    });

    expect(
      mod.generateSpace('space-1', 'product', 0, mod.PRODUCT_CATEGORIES[0], deps)
    ).toMatchObject({
      id: 'space-1',
      template: 'product',
      is_public: 1,
    });

    expect(mod.generateSpaceFile('space-1', 'file-1', 1, deps)).toMatchObject({
      space_id: 'space-1',
      file_id: 'file-1',
      sort_order: 1,
      section: null,
    });

    expect(mod.generateSpaceSalespersonShare('space-1', 'sp-1', deps)).toMatchObject({
      space_id: 'space-1',
      salesperson_id: 'sp-1',
    });
  });
});

describe('seed sql builder and cli runner', () => {
  it('builds a transactional sql batch and summary', async () => {
    const mod = await importScript();
    const result = mod.generateSeedSql({ count: 2 }, createDeterministicDeps());

    expect(result.finalSql).toContain('PRAGMA foreign_keys = OFF;');
    expect(result.finalSql).toContain('BEGIN TRANSACTION;');
    expect(result.finalSql).toContain('COMMIT;');
    expect(result.finalSql).toContain('INSERT OR IGNORE INTO "salespersons"');
    expect(result.finalSql).toContain('INSERT OR IGNORE INTO "products"');
    expect(result.finalSql).toContain('UPDATE spaces SET cover_file_id');
    expect(result.summary).toEqual({
      count: 2,
      salespersonCount: 1,
      customerCount: 1,
      folderCount: 1,
      blobCount: 2,
      fileCount: 2,
      orderCount: 1,
      timelineCount: 2,
      notificationCount: 1,
      spaceCount: 60,
      productCount: 2,
      templates: ['gallery', 'product', 'portfolio', 'document', 'collection', 'custom'],
    });
    expect(result.sqlStatements.length).toBeGreaterThan(100);
  });

  it('runs the cli, logs progress, and returns 0 on both success and handled write failure', async () => {
    const mod = await importScript();
    const successLines = [];
    const executeSqlImpl = vi.fn(() => true);

    const successExitCode = await mod.runSeedCli({
      argv: ['--count', '2'],
      deps: createDeterministicDeps(),
      log: (line, type = 'info') => successLines.push({ line, type }),
      executeSqlImpl,
    });

    expect(successExitCode).toBe(0);
    expect(executeSqlImpl).toHaveBeenCalledTimes(1);
    expect(successLines.map((entry) => entry.line).join('\n')).toContain('SQL 语句生成完成');
    expect(successLines.map((entry) => entry.line).join('\n')).toContain('种子数据生成完成');

    const failureLines = [];
    const failureExitCode = await mod.runSeedCli({
      argv: ['--count', '2'],
      deps: createDeterministicDeps(),
      log: (line, type = 'info') => failureLines.push({ line, type }),
      executeSqlImpl: () => false,
    });

    expect(failureExitCode).toBe(0);
    expect(failureLines.map((entry) => entry.line).join('\n')).toContain('数据库写入失败');
  });

  it('returns 1 when the seed runner throws unexpectedly', async () => {
    const mod = await importScript();
    const lines = [];

    const exitCode = await mod.runSeedCli({
      argv: ['--count', '2'],
      deps: createDeterministicDeps({
        uuid: () => {
          throw new Error('uuid broken');
        },
      }),
      log: (line, type = 'info') => lines.push({ line, type }),
    });

    expect(exitCode).toBe(1);
    expect(lines.map((entry) => entry.line).join('\n')).toContain('种子生成失败: uuid broken');
  });
});
