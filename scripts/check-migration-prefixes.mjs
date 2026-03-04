#!/usr/bin/env node
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

export function assertNoDuplicatePrefixes(fileNames = []) {
  const duplicates = findDuplicatePrefixes(fileNames);
  if (!duplicates.length) return;

  const details = duplicates.map((d) => `${d.prefix}: ${d.files.join(', ')}`).join('\n');
  throw new Error(`Duplicate migration prefixes detected:\n${details}`);
}

export function checkMigrationDirectory(migrationsDir) {
  const files = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name);
  assertNoDuplicatePrefixes(files);
}

function runCli() {
  const root = process.cwd();
  const migrationsDir = path.resolve(root, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`migrations directory not found: ${migrationsDir}`);
  }

  checkMigrationDirectory(migrationsDir);
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

