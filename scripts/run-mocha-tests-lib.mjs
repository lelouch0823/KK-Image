import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Mocha from 'mocha';

const VITEST_IMPORT_RE = /from\s+['"]vitest['"]|require\(['"]vitest['"]\)/;
const MOCHA_TEST_RE = /\bdescribe\s*\(|\bdescribeIfRealApi\s*\(/;
const EXCLUDED_BASENAMES = new Set(['verify-all-apis.js', 'webhook-test.js']);

export async function collectTestFiles(dir, options = {}) {
  const readdirImpl = options.readdirImpl || readdir;
  const readFileImpl = options.readFileImpl || readFile;
  const pathModule = options.pathModule || path;
  const entries = await readdirImpl(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = pathModule.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'fixtures' || entry.name === 'utils') {
        continue;
      }
      files.push(...(await collectTestFiles(fullPath, options)));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }
    if (EXCLUDED_BASENAMES.has(entry.name)) {
      continue;
    }

    const source = await readFileImpl(fullPath, 'utf8');
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

export function createRunMochaTestsRunner(options = {}) {
  const root = options.root || process.cwd();
  const pathModule = options.pathModule || path;
  const consoleImpl = options.consoleImpl || console;
  const processImpl = options.processImpl || process;
  const MochaCtor = options.MochaCtor || Mocha;
  const readdirImpl = options.readdirImpl || readdir;
  const readFileImpl = options.readFileImpl || readFile;
  const testRoot = pathModule.join(root, 'test');

  async function main() {
    const mocha = new MochaCtor({
      color: true,
      exit: true,
    });

    const files = await collectTestFiles(testRoot, {
      readdirImpl,
      readFileImpl,
      pathModule,
    });

    if (files.length === 0) {
      consoleImpl.log('No Mocha test files found.');
      processImpl.exit(0);
      return { files, failures: 0 };
    }

    files.forEach((file) => mocha.addFile(file));
    await mocha.loadFilesAsync();

    const failures = await new Promise((resolve) => {
      mocha.run((count) => resolve(count));
    });

    processImpl.exitCode = failures > 0 ? 1 : 0;
    return { files, failures };
  }

  return { main };
}

export async function runMochaTestsCli(options = {}) {
  const runner = createRunMochaTestsRunner(options);
  return runner.main();
}
