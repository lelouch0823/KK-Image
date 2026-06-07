import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/d1-safe-migrate.mjs');

async function importScript() {
  return import(`${pathToFileURL(SCRIPT_PATH).href}?t=${Date.now()}-${Math.random()}`);
}

describe('d1-safe-migrate', () => {
  it('exports reusable helpers for safe migration flow', async () => {
    const mod = await importScript();

    expect(typeof mod.extractFailedMigrationName).toBe('function');
    expect(typeof mod.isRecoverableIncompleteInput).toBe('function');
    expect(typeof mod.createSafeMigrateRunner).toBe('function');
    expect(typeof mod.runSafeMigrateCli).toBe('function');
  });

  it('completes immediately when wrangler apply succeeds', async () => {
    const mod = await importScript();
    const writeOut = vi.fn();
    const writeErr = vi.fn();
    const runWrangler = vi.fn(() => ({ ok: true, output: 'ok' }));

    const result = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler,
      writeStdout: writeOut,
      writeStderr: writeErr,
      existsSync: vi.fn(),
      cwd: '/repo',
      env: {},
    });

    expect(result).toBe(0);
    expect(runWrangler).toHaveBeenCalledTimes(1);
    expect(runWrangler).toHaveBeenCalledWith(
      ['d1', 'migrations', 'apply', 'DB', '--env', 'preview', '--remote'],
      expect.objectContaining({ retries: 2 })
    );
    expect(writeErr).toHaveBeenCalledWith(
      '[safe-migrate] migration flow completed successfully.\n'
    );
  });

  it('falls back to --file execution for recoverable incomplete-input parser failures', async () => {
    const mod = await importScript();
    const writeErr = vi.fn();
    const runWrangler = vi
      .fn()
      .mockReturnValueOnce({
        ok: false,
        output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
        status: 1,
      })
      .mockReturnValueOnce({ ok: true, output: 'executed' })
      .mockReturnValueOnce({ ok: true, output: 'marked' })
      .mockReturnValueOnce({ ok: true, output: 'all clean' });

    const result = await mod.runSafeMigrateCli({
      argv: ['production'],
      runWrangler,
      writeStdout: vi.fn(),
      writeStderr: writeErr,
      existsSync: vi.fn(() => true),
      cwd: '/repo',
      env: { D1_SAFE_MAX_FALLBACKS: '3', D1_SAFE_TRANSIENT_RETRIES: '1' },
    });

    expect(result).toBe(0);
    expect(runWrangler).toHaveBeenNthCalledWith(
      2,
      [
        'd1',
        'execute',
        'DB',
        '--env',
        'production',
        '--remote',
        '--file',
        'migrations/2026_fix.sql',
      ],
      expect.objectContaining({ retries: 1 })
    );
    expect(runWrangler).toHaveBeenNthCalledWith(
      3,
      expect.arrayContaining([
        'd1',
        'execute',
        'DB',
        '--env',
        'production',
        '--remote',
        '--command',
        "INSERT OR IGNORE INTO d1_migrations(name) VALUES ('2026_fix.sql');",
      ]),
      expect.objectContaining({ retries: 1 })
    );
    expect(writeErr).toHaveBeenCalledWith(
      '[safe-migrate] detected wrangler parser failure on 2026_fix.sql, using --file fallback...\n'
    );
    expect(writeErr).toHaveBeenCalledWith(
      '[safe-migrate] fallback completed for 2026_fix.sql, continuing...\n'
    );
  });

  it('aborts when fallback target is missing or non-recoverable', async () => {
    const mod = await importScript();

    const missingFile = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler: vi.fn(() => ({
        ok: false,
        output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
        status: 9,
      })),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      existsSync: vi.fn(() => false),
      cwd: '/repo',
      env: {},
    });

    expect(missingFile).toBe(1);

    const nonRecoverable = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler: vi.fn(() => ({
        ok: false,
        output: 'permission denied',
        status: 7,
      })),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      existsSync: vi.fn(() => true),
      cwd: '/repo',
      env: {},
    });

    expect(nonRecoverable).toBe(7);
  });

  it('rejects invalid env names before running wrangler', async () => {
    const mod = await importScript();
    const runWrangler = vi.fn();
    const writeErr = vi.fn();

    const result = await mod.runSafeMigrateCli({
      argv: ['staging'],
      runWrangler,
      writeStdout: vi.fn(),
      writeStderr: writeErr,
      existsSync: vi.fn(),
      cwd: '/repo',
      env: {},
    });

    expect(result).toBe(1);
    expect(runWrangler).not.toHaveBeenCalled();
    expect(writeErr).toHaveBeenCalledWith(
      'Usage: node scripts/d1-safe-migrate.mjs <preview|production>\n'
    );
  });

  it('retries transient wrangler failures and forwards stdout/stderr', async () => {
    const mod = await importScript();
    const writeOut = vi.fn();
    const writeErr = vi.fn();
    const spawnSync = vi
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stdout: 'warn-out',
        stderr: 'timed out',
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: 'final-out',
        stderr: '',
      });

    const runner = mod.createSafeMigrateRunner({
      cwd: '/repo',
      env: {},
      spawnSync,
      writeStdout: writeOut,
      writeStderr: writeErr,
      pnpmBin: 'pnpm',
      useShell: false,
    });

    const result = runner.runWrangler(['d1', 'migrations', 'apply'], { retries: 1 });

    expect(result).toEqual({ ok: true, output: 'final-out\n' });
    expect(spawnSync).toHaveBeenCalledTimes(2);
    expect(writeOut).toHaveBeenCalledWith('warn-out');
    expect(writeOut).toHaveBeenCalledWith('final-out');
    expect(writeErr).toHaveBeenCalledWith('timed out');
    expect(writeErr).toHaveBeenCalledWith(
      '[safe-migrate] transient network error, retrying (1/2)...\n'
    );
  });

  it('reports process execution errors from wrangler invocations', async () => {
    const mod = await importScript();
    const writeErr = vi.fn();
    const runner = mod.createSafeMigrateRunner({
      cwd: '/repo',
      env: {},
      spawnSync: vi.fn(() => ({
        status: 1,
        stdout: '',
        stderr: '',
        error: new Error('spawn failed'),
      })),
      writeStdout: vi.fn(),
      writeStderr: writeErr,
      pnpmBin: 'pnpm',
      useShell: false,
    });

    const result = runner.runWrangler(['d1'], { retries: 0 });

    expect(result).toEqual({ ok: false, output: '\n', status: 1 });
    expect(writeErr).toHaveBeenCalledWith(
      '[safe-migrate] failed to execute "pnpm": spawn failed\n'
    );
  });

  it('aborts when fallback execute or mark-applied steps fail, and when the same migration loops again', async () => {
    const mod = await importScript();

    const executeFail = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler: vi
        .fn()
        .mockReturnValueOnce({
          ok: false,
          output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
          status: 5,
        })
        .mockReturnValueOnce({ ok: false, output: 'execute failed', status: 6 }),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      existsSync: vi.fn(() => true),
      cwd: '/repo',
      env: {},
    });
    expect(executeFail).toBe(6);

    const markFail = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler: vi
        .fn()
        .mockReturnValueOnce({
          ok: false,
          output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
          status: 5,
        })
        .mockReturnValueOnce({ ok: true, output: 'executed' })
        .mockReturnValueOnce({ ok: false, output: 'mark failed', status: 8 }),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      existsSync: vi.fn(() => true),
      cwd: '/repo',
      env: {},
    });
    expect(markFail).toBe(8);

    const repeatedMigration = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler: vi
        .fn()
        .mockReturnValueOnce({
          ok: false,
          output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
          status: 5,
        })
        .mockReturnValueOnce({ ok: true, output: 'executed' })
        .mockReturnValueOnce({ ok: true, output: 'marked' })
        .mockReturnValueOnce({
          ok: false,
          output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
          status: 9,
        }),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      existsSync: vi.fn(() => true),
      cwd: '/repo',
      env: { D1_SAFE_MAX_FALLBACKS: '2' },
    });
    expect(repeatedMigration).toBe(9);
  });

  it('stops after exceeding the configured fallback ceiling', async () => {
    const mod = await importScript();
    const writeErr = vi.fn();

    const result = await mod.runSafeMigrateCli({
      argv: ['preview'],
      runWrangler: vi.fn(() => ({
        ok: false,
        output: 'Migration 2026_fix.sql failed\nincomplete input: SQLITE_ERROR',
        status: 3,
      })),
      writeStdout: vi.fn(),
      writeStderr: writeErr,
      existsSync: vi.fn(() => true),
      cwd: '/repo',
      env: { D1_SAFE_MAX_FALLBACKS: '0' },
    });

    expect(result).toBe(1);
    expect(writeErr).toHaveBeenCalledWith(
      '[safe-migrate] exceeded max fallback attempts (0). please investigate manually.\n'
    );
  });
});
