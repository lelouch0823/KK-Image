import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Mocha from 'mocha';

const ROOT = process.cwd();
const TEST_ROOT = path.join(ROOT, 'test');
const VITEST_IMPORT_RE = /from\s+['"]vitest['"]|require\(['"]vitest['"]\)/;
const MOCHA_TEST_RE = /\bdescribe\s*\(|\bdescribeIfRealApi\s*\(/;
const EXCLUDED_BASENAMES = new Set([
  'verify-all-apis.js',
  'webhook-test.js',
]);

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'fixtures' || entry.name === 'utils') {
        continue;
      }
      files.push(...await collectTestFiles(fullPath));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }
    if (EXCLUDED_BASENAMES.has(entry.name)) {
      continue;
    }

    const source = await readFile(fullPath, 'utf8');
    if (VITEST_IMPORT_RE.test(source)) {
      continue;
    }
    if (!MOCHA_TEST_RE.test(source)) {
      continue;
    }
    files.push(fullPath);
  }

  return files.sort();
}

const mocha = new Mocha({
  color: true,
  exit: true,
});

const files = await collectTestFiles(TEST_ROOT);

if (files.length === 0) {
  console.log('No Mocha test files found.');
  process.exit(0);
}

files.forEach((file) => mocha.addFile(file));

await mocha.loadFilesAsync();

const failures = await new Promise((resolve) => {
  mocha.run((count) => resolve(count));
});

process.exitCode = failures > 0 ? 1 : 0;
