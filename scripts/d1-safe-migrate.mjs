#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export function extractFailedMigrationName(output) {
  const match = String(output || '').match(/Migration\s+([A-Za-z0-9._-]+\.sql)\s+failed/i);
  return match ? match[1] : null;
}

export function isRecoverableIncompleteInput(output) {
  return /incomplete input:\s*SQLITE_ERROR/i.test(String(output || ''));
}

export function createSafeMigrateRunner(options = {}) {
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const allowedEnvs = options.allowedEnvs || new Set(['preview', 'production']);
  const pnpmBin = options.pnpmBin || (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const useShell = options.useShell ?? process.platform === 'win32';
  const spawn = options.spawnSync || spawnSync;
  const writeStdout = options.writeStdout || ((text) => process.stdout.write(text));
  const writeStderr = options.writeStderr || ((text) => process.stderr.write(text));

  function defaultRunWrangler(args, runOptions = {}) {
    const retries = runOptions.retries ?? 0;
    let attempt = 0;

    while (attempt <= retries) {
      const result = spawn(pnpmBin, ['wrangler', ...args], {
        cwd,
        encoding: 'utf8',
        shell: useShell,
      });

      if (result.error) {
        const errorMessage = result.error?.message ?? String(result.error);
        writeStderr(`[safe-migrate] failed to execute "${pnpmBin}": ${errorMessage}\n`);
      }

      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';
      const output = `${stdout}\n${stderr}`;

      if (stdout) writeStdout(stdout);
      if (stderr) writeStderr(stderr);

      if (result.status === 0) {
        return { ok: true, output };
      }

      const isTransientNetworkError =
        /timed out|fetch failed|connectivity issue|slow network/i.test(output);

      if (isTransientNetworkError && attempt < retries) {
        const retryIndex = attempt + 1;
        const totalAttempts = retries + 1;
        writeStderr(
          `[safe-migrate] transient network error, retrying (${retryIndex}/${totalAttempts})...\n`
        );
        attempt += 1;
        continue;
      }

      return { ok: false, output, status: result.status ?? 1 };
    }

    return { ok: false, output: '', status: 1 };
  }

  const runWrangler = options.runWrangler || defaultRunWrangler;

  function runMainApply(envName, transientRetryCount) {
    return runWrangler(['d1', 'migrations', 'apply', 'DB', '--env', envName, '--remote'], {
      retries: transientRetryCount,
    });
  }

  function runFallbackExecute(envName, migrationName, transientRetryCount) {
    return runWrangler(
      [
        'd1',
        'execute',
        'DB',
        '--env',
        envName,
        '--remote',
        '--file',
        `migrations/${migrationName}`,
      ],
      { retries: transientRetryCount }
    );
  }

  function markMigrationApplied(envName, migrationName, transientRetryCount) {
    const escaped = migrationName.replace(/'/g, "''");
    return runWrangler(
      [
        'd1',
        'execute',
        'DB',
        '--env',
        envName,
        '--remote',
        '--command',
        `INSERT OR IGNORE INTO d1_migrations(name) VALUES ('${escaped}');`,
      ],
      { retries: transientRetryCount }
    );
  }

  return {
    allowedEnvs,
    cwd,
    env,
    runWrangler,
    runMainApply,
    runFallbackExecute,
    markMigrationApplied,
    writeStderr,
  };
}

export async function runSafeMigrateCli(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const envName = argv[0];
  const runner = createSafeMigrateRunner(options);
  const maxFallbacks = Number(runner.env.D1_SAFE_MAX_FALLBACKS ?? 20);
  const transientRetryCount = Number(runner.env.D1_SAFE_TRANSIENT_RETRIES ?? 2);
  const existsSync = options.existsSync || fs.existsSync;
  const handledMigrations = new Set();

  if (!runner.allowedEnvs.has(envName)) {
    runner.writeStderr('Usage: node scripts/d1-safe-migrate.mjs <preview|production>\n');
    return 1;
  }

  for (let i = 0; i < maxFallbacks; i += 1) {
    const applyResult = runner.runMainApply(envName, transientRetryCount);
    if (applyResult.ok) {
      runner.writeStderr('[safe-migrate] migration flow completed successfully.\n');
      return 0;
    }

    const failedMigration = extractFailedMigrationName(applyResult.output);
    const recoverable = isRecoverableIncompleteInput(applyResult.output);

    if (!failedMigration || !recoverable) {
      runner.writeStderr('[safe-migrate] apply failed with non-recoverable error. aborting.\n');
      return applyResult.status ?? 1;
    }

    if (handledMigrations.has(failedMigration)) {
      runner.writeStderr(
        `[safe-migrate] migration ${failedMigration} was already handled once, but apply still fails. aborting.\n`
      );
      return applyResult.status ?? 1;
    }

    const migrationFilePath = path.join(runner.cwd, 'migrations', failedMigration);
    if (!existsSync(migrationFilePath)) {
      runner.writeStderr(`[safe-migrate] migration file not found: ${migrationFilePath}\n`);
      return 1;
    }

    runner.writeStderr(
      `[safe-migrate] detected wrangler parser failure on ${failedMigration}, using --file fallback...\n`
    );

    const executeResult = runner.runFallbackExecute(envName, failedMigration, transientRetryCount);
    if (!executeResult.ok) {
      runner.writeStderr(
        `[safe-migrate] fallback execute failed for ${failedMigration}. aborting.\n`
      );
      return executeResult.status ?? 1;
    }

    const markResult = runner.markMigrationApplied(envName, failedMigration, transientRetryCount);
    if (!markResult.ok) {
      runner.writeStderr(
        `[safe-migrate] failed to mark ${failedMigration} in d1_migrations. aborting.\n`
      );
      return markResult.status ?? 1;
    }

    handledMigrations.add(failedMigration);
    runner.writeStderr(`[safe-migrate] fallback completed for ${failedMigration}, continuing...\n`);
  }

  runner.writeStderr(
    `[safe-migrate] exceeded max fallback attempts (${maxFallbacks}). please investigate manually.\n`
  );
  return 1;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const exitCode = await runSafeMigrateCli();
  process.exit(exitCode);
}
