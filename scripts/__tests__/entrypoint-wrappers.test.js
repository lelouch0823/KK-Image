import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const originalArgv = [...process.argv];
const originalExitCode = process.exitCode;
const testDir = path.dirname(fileURLToPath(import.meta.url));

const importFresh = async (relativePath) =>
  import(
    `${pathToFileURL(path.resolve(testDir, relativePath)).href}?t=${Date.now()}-${Math.random()}`
  );

afterEach(() => {
  process.argv = [...originalArgv];
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('script entrypoint wrappers', () => {
  it('re-exports commonjs wrapper helpers without auto-running the CLI path', () => {
    const smokePath = require.resolve('../qa/admin-business-flow-smoke.cjs');
    const adminDocPath = require.resolve('../docs/capture-admin-manual-screenshots.cjs');
    const userDocPath = require.resolve('../docs/capture-user-manual-screenshots.cjs');

    delete require.cache[smokePath];
    delete require.cache[adminDocPath];
    delete require.cache[userDocPath];

    const smoke = require(smokePath);
    const adminDoc = require(adminDocPath);
    const userDoc = require(userDocPath);

    expect(smoke).toEqual(
      expect.objectContaining({
        createAdminBusinessFlowSmokeRunner: expect.any(Function),
        createSeed: expect.any(Function),
        createImportCsv: expect.any(Function),
      })
    );
    expect(adminDoc).toEqual(
      expect.objectContaining({
        runCaptureAdminManualScreenshotsCli: expect.any(Function),
        createCaptureAdminManualScreenshotsRunner: expect.any(Function),
      })
    );
    expect(userDoc).toEqual(
      expect.objectContaining({
        runCaptureUserManualScreenshotsCli: expect.any(Function),
        createCaptureUserManualScreenshotsRunner: expect.any(Function),
        resolveDocFixtures: expect.any(Function),
      })
    );
  });

  it('invokes the compile and seed cli runners when directly executed', async () => {
    const runCompileOpaCli = vi.fn();
    const runSeedPoTestDataCli = vi.fn();

    vi.doMock('../policy/compile-opa-lib.mjs', () => ({ runCompileOpaCli }));
    vi.doMock('../seed-po-test-data-lib.mjs', () => ({ runSeedPoTestDataCli }));

    process.argv = ['node', path.resolve(testDir, '../policy/compile-opa.mjs')];
    const compileModule = await importFresh('../policy/compile-opa.mjs');
    expect(compileModule.runCompileOpaCli).toBe(runCompileOpaCli);
    expect(runCompileOpaCli).toHaveBeenCalledTimes(1);

    vi.resetModules();
    process.argv = ['node', path.resolve(testDir, '../seed-po-test-data.js')];
    const seedModule = await importFresh('../seed-po-test-data.js');
    expect(seedModule.runSeedPoTestDataCli).toBe(runSeedPoTestDataCli);
    expect(runSeedPoTestDataCli).toHaveBeenCalledTimes(1);
  });

  it('re-exports the admin audit helpers and handles direct cli failures', async () => {
    const runAdminHeadlessAuditCli = vi.fn(async () => {
      throw new Error('boom');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined);

    vi.doMock('../qa/admin-headless-audit-lib.mjs', () => ({
      runAdminHeadlessAuditCli,
      createAdminHeadlessAuditRunner: vi.fn(),
      adminRoutes: [],
      allowPayload: vi.fn(),
      evaluateAdminAuditResults: vi.fn(),
      makeResponse: vi.fn(),
      pageMeta: vi.fn(),
      pickChromePath: vi.fn(),
      sleep: vi.fn(),
      waitForJson: vi.fn(),
    }));

    process.argv = ['node', path.resolve(testDir, '../qa/admin-headless-audit.mjs')];
    const auditModule = await importFresh('../qa/admin-headless-audit.mjs');
    await Promise.resolve();

    expect(auditModule.runAdminHeadlessAuditCli).toBe(runAdminHeadlessAuditCli);
    expect(runAdminHeadlessAuditCli).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[audit] failed:', expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('run-mocha-tests entrypoint', () => {
  it('delegates execution to the run-mocha lib entrypoint', async () => {
    const runMochaTestsCli = vi.fn(async () => undefined);

    vi.doMock('../run-mocha-tests-lib.mjs', () => ({
      runMochaTestsCli,
      collectTestFiles: vi.fn(),
      createRunMochaTestsRunner: vi.fn(),
    }));

    const wrapperModule = await importFresh('../run-mocha-tests.mjs');

    expect(wrapperModule.runMochaTestsCli).toBe(runMochaTestsCli);
    expect(runMochaTestsCli).toHaveBeenCalledTimes(1);
  });
});
