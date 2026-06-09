import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRealApiTestTimeoutMs } from '../../test/utils/manage-products-real-api.js';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/run-real-api-tests.mjs');

async function importScript() {
  return import(`${pathToFileURL(SCRIPT_PATH).href}?t=${Date.now()}-${Math.random()}`);
}

describe('run-real-api-tests', () => {
  it('exports reusable profile helpers and cli runner', async () => {
    const mod = await importScript();

    expect(typeof mod.resolveRealApiProfile).toBe('function');
    expect(typeof mod.createVitestSpawner).toBe('function');
    expect(typeof mod.runRealApiCli).toBe('function');
  });

  it('rejects unknown profiles without spawning vitest', async () => {
    const mod = await importScript();
    const spawnVitest = vi.fn();
    const writeErr = vi.fn();

    const result = await mod.runRealApiCli({
      argv: ['bad-profile'],
      env: {},
      spawnVitest,
      writeStdout: vi.fn(),
      writeStderr: writeErr,
      killProcess: vi.fn(),
    });

    expect(result).toBe(1);
    expect(spawnVitest).not.toHaveBeenCalled();
    expect(writeErr).toHaveBeenCalledWith(
      expect.stringContaining('Unknown REAL_API_PROFILE "bad-profile"')
    );
  });

  it('runs non-isolated profiles in a single vitest invocation with shared env', async () => {
    const mod = await importScript();
    const spawnVitest = vi.fn(async (files, env) => {
      expect(files).toEqual([
        'test/manage-products-authz.test.js',
        'test/manage-products-barcode-rule.test.js',
        'test/manage-products-batch.test.js',
        'test/manage-products-workflow.test.js',
        'test/manage-inventory-linkage-workflow.test.js',
        'test/customers-real-api.test.js',
        'test/salespersons-real-api.test.js',
        'test/sales-files-real-api.test.js',
        'test/dashboard-stats-real-api.test.js',
        'test/search-tags-real-api.test.js',
        'test/order-module-real-api.test.js',
        'test/folders-real-api.test.js',
        'test/public-share-real-api.test.js',
        'test/public-space-real-api.test.js',
        'test/sales-order-collaboration-real-api.test.js',
        'test/sales-product-availability-real-api.test.js',
        'test/sales-spaces-real-api.test.js',
        'test/uploads-real-api.test.js',
      ]);
      expect(env.REAL_API_SALES_DIRECT).toBe('1');
      expect(env.REAL_API_BASE_URL).toBe('http://127.0.0.1:8080');
      expect(env.RUN_REAL_API_TESTS).toBe('1');
      expect(env.BASIC_USER).toBe('admin');
      expect(env.BASIC_PASS).toBe('123');
      expect(env.JWT_SECRET).toBe('dev-secret-key-123');
      expect(env.CRON_SECRET).toBe('dev-secret');
      return { code: 0 };
    });

    const result = await mod.runRealApiCli({
      argv: ['smoke'],
      env: {},
      spawnVitest,
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      killProcess: vi.fn(),
    });

    expect(result).toBe(0);
    expect(spawnVitest).toHaveBeenCalledTimes(1);
  });

  it('honors explicit REAL_API_FILES overrides and isolate mode', async () => {
    const mod = await importScript();
    const spawnVitest = vi
      .fn()
      .mockResolvedValueOnce({ code: 0 })
      .mockResolvedValueOnce({ code: 0 });
    const writeOut = vi.fn();

    const result = await mod.runRealApiCli({
      argv: ['coverage:blackbox'],
      env: { REAL_API_FILES: 'a.test.js,b.test.js' },
      spawnVitest,
      writeStdout: writeOut,
      writeStderr: vi.fn(),
      killProcess: vi.fn(),
    });

    expect(result).toBe(0);
    expect(spawnVitest).toHaveBeenNthCalledWith(1, ['a.test.js'], expect.any(Object));
    expect(spawnVitest).toHaveBeenNthCalledWith(2, ['b.test.js'], expect.any(Object));
    expect(writeOut).toHaveBeenCalledWith('[real-api] running a.test.js\n');
    expect(writeOut).toHaveBeenCalledWith('[real-api] running b.test.js\n');
  });

  it('stops isolated runs on first failure and forwards process signals', async () => {
    const mod = await importScript();
    const killProcess = vi.fn();

    const failed = await mod.runRealApiCli({
      argv: ['blackbox'],
      env: { REAL_API_FILES: 'a.test.js,b.test.js' },
      spawnVitest: vi.fn().mockResolvedValueOnce({ code: 1 }),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      killProcess,
    });
    expect(failed).toBe(1);
    expect(killProcess).not.toHaveBeenCalled();

    const signaled = await mod.runRealApiCli({
      argv: ['smoke'],
      env: {},
      spawnVitest: vi.fn().mockResolvedValueOnce({ code: 1, signal: 'SIGTERM' }),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      killProcess,
    });
    expect(signaled).toBeNull();
    expect(killProcess).toHaveBeenCalledWith(process.pid, 'SIGTERM');
  });

  it('builds a spawnVitest adapter around child_process.spawn', async () => {
    const mod = await importScript();
    const handlers = {};
    const spawn = vi.fn(() => ({
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
    }));

    const spawnVitest = mod.createVitestSpawner({
      spawn,
      nodeExecPath: '/node',
      baseEnv: { BASE_URL: 'http://example.com' },
    });

    const pending = spawnVitest(['a.test.js'], { FOO: 'bar' });
    handlers.exit(0, null);
    const result = await pending;

    expect(result).toEqual({ code: 0, signal: null });
    expect(spawn).toHaveBeenCalledWith(
      '/node',
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--environment',
        'node',
        '--maxWorkers',
        '1',
        'a.test.js',
      ],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.objectContaining({
          BASE_URL: 'http://example.com',
          FOO: 'bar',
        }),
      })
    );
  });
});

describe('real API test utilities', () => {
  it('resolves a positive REAL_API_TEST_TIMEOUT_MS override', () => {
    expect(
      resolveRealApiTestTimeoutMs(120000, {
        REAL_API_TEST_TIMEOUT_MS: '300000',
      })
    ).toBe(300000);
  });

  it('falls back to the default timeout when override is missing or invalid', () => {
    expect(resolveRealApiTestTimeoutMs(120000, {})).toBe(120000);
    expect(resolveRealApiTestTimeoutMs(120000, { REAL_API_TEST_TIMEOUT_MS: '0' })).toBe(120000);
    expect(resolveRealApiTestTimeoutMs(120000, { REAL_API_TEST_TIMEOUT_MS: 'bad' })).toBe(120000);
  });
});
