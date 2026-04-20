import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalArgv = [...process.argv];
const testDir = path.dirname(fileURLToPath(import.meta.url));

const importFresh = async () =>
  import(`${pathToFileURL(path.resolve(testDir, '../run-opa.mjs')).href}?t=${Date.now()}-${Math.random()}`);

afterEach(() => {
  process.argv = [...originalArgv];
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('run-opa entrypoint', () => {
  it('prints usage and exits when no opa args are provided', async () => {
    const runOpa = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSignal = new Error('process.exit');
    exitSignal.code = 1;

    process.argv = ['node', path.resolve(testDir, '../run-opa.mjs')];
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitSignal.code = code;
      throw exitSignal;
    });
    vi.doMock('../opa-utils.mjs', () => ({ runOpa }));

    await expect(importFresh()).rejects.toMatchObject({ code: 1 });
    expect(errorSpy).toHaveBeenCalledWith('Usage: node scripts/policy/run-opa.mjs <opa-args...>');
    expect(runOpa).not.toHaveBeenCalled();
  });

  it('passes through cli args to the opa helper', async () => {
    const runOpa = vi.fn();

    process.argv = ['node', path.resolve(testDir, '../run-opa.mjs'), 'eval', 'data.kk.allow'];
    vi.doMock('../opa-utils.mjs', () => ({ runOpa }));

    await importFresh();

    expect(runOpa).toHaveBeenCalledWith(['eval', 'data.kk.allow']);
  });

  it('logs helper failures and exits non-zero', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSignal = new Error('process.exit');
    exitSignal.code = 1;

    process.argv = ['node', path.resolve(testDir, '../run-opa.mjs'), 'eval'];
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitSignal.code = code;
      throw exitSignal;
    });
    vi.doMock('../opa-utils.mjs', () => ({
      runOpa: vi.fn(() => {
        throw new Error('spawn failed');
      }),
    }));

    await expect(importFresh()).rejects.toMatchObject({ code: 1 });
    expect(errorSpy).toHaveBeenCalledWith('[authz] failed to run opa:', 'spawn failed');
  });
});
