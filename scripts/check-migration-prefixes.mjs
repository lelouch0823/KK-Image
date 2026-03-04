import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractPrefix(fileName) {
  const match = /^(\d{4,})_/.exec(fileName);
  return match ? match[1] : null;
}

export function findDuplicatePrefixes(fileNames = []) {
  const byPrefix = new Map();
  for (const fileName of fileNames) {
    const prefix = extractPrefix(fileName);
    if (!prefix) continue;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(fileName);
  }

  return [...byPrefix.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([prefix, files]) => ({ prefix, files: [...files].sort() }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

export function normalizeAllowlist(raw = {}) {
  const normalized = {};
  for (const [prefix, files] of Object.entries(raw || {})) {
    if (!Array.isArray(files)) continue;
    normalized[String(prefix)] = [...new Set(files.map(String))].sort();
  }
  return normalized;
}

export function arraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function loadAllowlist(allowlistPath) {
  if (!allowlistPath || !fs.existsSync(allowlistPath)) return {};
  const raw = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  return normalizeAllowlist(raw);
}

export function assertNoDuplicatePrefixes(fileNames = [], allowlist = {}) {
  const duplicates = findDuplicatePrefixes(fileNames);
  if (!duplicates.length) return;

  const normalizedAllowlist = normalizeAllowlist(allowlist);
  const failures = [];

  for (const duplicate of duplicates) {
    const expectedFiles = normalizedAllowlist[duplicate.prefix];
    if (!expectedFiles) {
      failures.push({
        type: 'duplicate',
        prefix: duplicate.prefix,
        files: duplicate.files,
      });
      continue;
    }

    if (!arraysEqual(duplicate.files, expectedFiles)) {
      failures.push({
        type: 'allowlist-mismatch',
        prefix: duplicate.prefix,
        files: duplicate.files,
        expectedFiles,
      });
    }
  }

  if (!failures.length) return;

  const details = failures
    .map((failure) => {
      if (failure.type === 'allowlist-mismatch') {
        return `${failure.prefix} allowlist mismatch: actual=[${failure.files.join(', ')}], expected=[${failure.expectedFiles.join(', ')}]`;
      }
      return `${failure.prefix}: ${failure.files.join(', ')}`;
    })
    .join('\n');

  throw new Error(`Duplicate migration prefixes detected:\n${details}`);
}

export function checkMigrationDirectory(migrationsDir, allowlist = {}) {
  const files = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name);
  assertNoDuplicatePrefixes(files, allowlist);
}

function runCli() {
  const root = process.cwd();
  const migrationsDir = path.resolve(root, 'migrations');
  const allowlistPath = path.resolve(root, 'scripts/migration-prefix-allowlist.json');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`migrations directory not found: ${migrationsDir}`);
  }

  const allowlist = loadAllowlist(allowlistPath);
  checkMigrationDirectory(migrationsDir, allowlist);
  console.log(`[migrations] prefix check passed (${migrationsDir})`);
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isMain) {
  try {
    runCli();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
