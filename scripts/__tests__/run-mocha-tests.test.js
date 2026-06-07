import { describe, expect, it, vi } from 'vitest';

import { collectTestFiles, createRunMochaTestsRunner } from '../run-mocha-tests-lib.mjs';

describe('run-mocha-tests-lib', () => {
  const makeDirent = (name, kind = 'file') => ({
    name,
    isDirectory: () => kind === 'dir',
    isFile: () => kind === 'file',
  });

  it('collects only mocha-style js tests and skips vitest, fixtures, utils, and excluded basenames', async () => {
    const readdirImpl = vi.fn(async (dir) => {
      if (dir === '/repo/test') {
        return [
          makeDirent('fixtures', 'dir'),
          makeDirent('utils', 'dir'),
          makeDirent('nested', 'dir'),
          makeDirent('alpha.js'),
          makeDirent('beta.js'),
          makeDirent('verify-all-apis.js'),
          makeDirent('readme.md'),
        ];
      }
      if (dir === '/repo/test/nested') {
        return [makeDirent('gamma.js')];
      }
      return [];
    });
    const readFileImpl = vi.fn(async (target) => {
      if (target.endsWith('alpha.js')) return "describe('alpha', () => {})";
      if (target.endsWith('beta.js'))
        return "import { describe } from 'vitest'; describe('beta', () => {})";
      if (target.endsWith('gamma.js')) return "describeIfRealApi('gamma', () => {})";
      return '';
    });

    const files = await collectTestFiles('/repo/test', {
      readdirImpl,
      readFileImpl,
      pathModule: {
        join: (...parts) => parts.join('/'),
      },
    });

    expect(files).toEqual(['/repo/test/alpha.js', '/repo/test/nested/gamma.js']);
  });

  it('logs and exits cleanly when no mocha files are discovered', async () => {
    const consoleImpl = { log: vi.fn() };
    const processImpl = { exit: vi.fn(), exitCode: 0 };
    const runner = createRunMochaTestsRunner({
      root: '/repo',
      readdirImpl: vi.fn(async () => []),
      readFileImpl: vi.fn(),
      consoleImpl,
      processImpl,
      pathModule: {
        join: (...parts) => parts.join('/'),
      },
      MochaCtor: vi.fn(() => ({
        addFile: vi.fn(),
        loadFilesAsync: vi.fn(),
        run: vi.fn(),
      })),
    });

    const result = await runner.main();

    expect(result).toEqual({ files: [], failures: 0 });
    expect(consoleImpl.log).toHaveBeenCalledWith('No Mocha test files found.');
    expect(processImpl.exit).toHaveBeenCalledWith(0);
  });

  it('runs discovered mocha files and propagates failure counts onto process.exitCode', async () => {
    const addFile = vi.fn();
    const loadFilesAsync = vi.fn(async () => undefined);
    const run = vi.fn((done) => done(2));
    const processImpl = { exit: vi.fn(), exitCode: 0 };
    const runner = createRunMochaTestsRunner({
      root: '/repo',
      readdirImpl: vi.fn(async (dir) => {
        if (dir === '/repo/test') return [makeDirent('alpha.js')];
        return [];
      }),
      readFileImpl: vi.fn(async () => "describe('alpha', () => {})"),
      processImpl,
      pathModule: {
        join: (...parts) => parts.join('/'),
      },
      MochaCtor: vi.fn(() => ({
        addFile,
        loadFilesAsync,
        run,
      })),
    });

    const result = await runner.main();

    expect(addFile).toHaveBeenCalledWith('/repo/test/alpha.js');
    expect(loadFilesAsync).toHaveBeenCalledTimes(1);
    expect(processImpl.exitCode).toBe(1);
    expect(result).toEqual({
      files: ['/repo/test/alpha.js'],
      failures: 2,
    });
  });
});
