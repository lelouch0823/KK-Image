#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const envName = process.argv[2];
const allowedEnvs = new Set(['preview', 'production']);
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const useShell = process.platform === 'win32';

if (!allowedEnvs.has(envName)) {
  console.error('Usage: node scripts/d1-safe-migrate.mjs <preview|production>');
  process.exit(1);
}

const repoRoot = process.cwd();
const maxFallbacks = Number(process.env.D1_SAFE_MAX_FALLBACKS ?? 20);
const transientRetryCount = Number(process.env.D1_SAFE_TRANSIENT_RETRIES ?? 2);

function runWrangler(args, options = {}) {
  const retries = options.retries ?? 0;
  let attempt = 0;

  while (attempt <= retries) {
    const result = spawnSync(pnpmBin, ['wrangler', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: useShell
    });

    if (result.error) {
      const errorMessage = result.error?.message ?? String(result.error);
      console.error(`[safe-migrate] failed to execute "${pnpmBin}": ${errorMessage}`);
    }

    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    const output = `${stdout}\n${stderr}`;

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);

    if (result.status === 0) {
      return { ok: true, output };
    }

    const isTransientNetworkError =
      /timed out|fetch failed|connectivity issue|slow network/i.test(output);

    if (isTransientNetworkError && attempt < retries) {
      const retryIndex = attempt + 1;
      const totalAttempts = retries + 1;
      console.error(
        `[safe-migrate] transient network error, retrying (${retryIndex}/${totalAttempts})...`
      );
      attempt += 1;
      continue;
    }

    return { ok: false, output, status: result.status ?? 1 };
  }

  return { ok: false, output: '', status: 1 };
}

function extractFailedMigrationName(output) {
  const match = output.match(/Migration\s+([A-Za-z0-9._-]+\.sql)\s+failed/i);
  return match ? match[1] : null;
}

function isRecoverableIncompleteInput(output) {
  return /incomplete input:\s*SQLITE_ERROR/i.test(output);
}

function runMainApply() {
  return runWrangler(
    ['d1', 'migrations', 'apply', 'DB', '--env', envName, '--remote'],
    { retries: transientRetryCount }
  );
}

function runFallbackExecute(migrationName) {
  return runWrangler(
    ['d1', 'execute', 'DB', '--env', envName, '--remote', '--file', `migrations/${migrationName}`],
    { retries: transientRetryCount }
  );
}

function markMigrationApplied(migrationName) {
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
      `INSERT OR IGNORE INTO d1_migrations(name) VALUES ('${escaped}');`
    ],
    { retries: transientRetryCount }
  );
}

const handledMigrations = new Set();

for (let i = 0; i < maxFallbacks; i += 1) {
  const applyResult = runMainApply();
  if (applyResult.ok) {
    console.error('[safe-migrate] migration flow completed successfully.');
    process.exit(0);
  }

  const failedMigration = extractFailedMigrationName(applyResult.output);
  const recoverable = isRecoverableIncompleteInput(applyResult.output);

  if (!failedMigration || !recoverable) {
    console.error('[safe-migrate] apply failed with non-recoverable error. aborting.');
    process.exit(applyResult.status ?? 1);
  }

  if (handledMigrations.has(failedMigration)) {
    console.error(
      `[safe-migrate] migration ${failedMigration} was already handled once, but apply still fails. aborting.`
    );
    process.exit(applyResult.status ?? 1);
  }

  const migrationFilePath = path.join(repoRoot, 'migrations', failedMigration);
  if (!fs.existsSync(migrationFilePath)) {
    console.error(`[safe-migrate] migration file not found: ${migrationFilePath}`);
    process.exit(1);
  }

  console.error(
    `[safe-migrate] detected wrangler parser failure on ${failedMigration}, using --file fallback...`
  );

  const executeResult = runFallbackExecute(failedMigration);
  if (!executeResult.ok) {
    console.error(`[safe-migrate] fallback execute failed for ${failedMigration}. aborting.`);
    process.exit(executeResult.status ?? 1);
  }

  const markResult = markMigrationApplied(failedMigration);
  if (!markResult.ok) {
    console.error(`[safe-migrate] failed to mark ${failedMigration} in d1_migrations. aborting.`);
    process.exit(markResult.status ?? 1);
  }

  handledMigrations.add(failedMigration);
  console.error(`[safe-migrate] fallback completed for ${failedMigration}, continuing...`);
}

console.error(
  `[safe-migrate] exceeded max fallback attempts (${maxFallbacks}). please investigate manually.`
);
process.exit(1);
