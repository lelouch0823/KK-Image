import { describe, expect, it, vi } from 'vitest';
import {
  cleanDist,
  createCompileOpaRunner,
  extractBundle,
  writeGeneratedArtifact,
} from '../compile-opa-lib.mjs';

describe('compile-opa-lib', () => {
  it('cleans dist output and writes generated artifacts', () => {
    const state = new Map();
    const fsModule = {
      mkdirSync: vi.fn(),
      existsSync: vi.fn((target) =>
        [
          '/repo/policy/dist',
          '/repo/policy/dist/policy.wasm',
          '/repo/policy/dist/data.json',
          '/repo/policy/metadata.json',
        ].includes(target)
      ),
      readdirSync: vi.fn(() => ['bundle.tar.gz', 'policy.wasm']),
      rmSync: vi.fn(),
      readFileSync: vi.fn((target) => {
        if (target.endsWith('data.json')) {
          return JSON.stringify({ rules: ['allow'] });
        }
        if (target.endsWith('metadata.json')) {
          return JSON.stringify({ version: 3 });
        }
        throw new Error(`unexpected read ${target}`);
      }),
      copyFileSync: vi.fn((from, to) => state.set(to, from)),
      writeFileSync: vi.fn((target, content) => state.set(target, content)),
    };
    const pathModule = {
      join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
    };

    cleanDist({
      fsModule,
      distDir: '/repo/policy/dist',
      pathModule,
    });
    expect(fsModule.rmSync).toHaveBeenCalledTimes(2);

    writeGeneratedArtifact({
      fsModule,
      pathModule,
      policyDir: '/repo/policy',
      distDir: '/repo/policy/dist',
      generatedDir: '/repo/functions/lib/authz/generated',
      generatedArtifact: '/repo/functions/lib/authz/generated/policy-artifact.js',
      generatedWasmArtifact: '/repo/functions/lib/authz/generated/policy-artifact.wasm',
    });

    expect(fsModule.copyFileSync).toHaveBeenCalledWith(
      '/repo/policy/dist/policy.wasm',
      '/repo/functions/lib/authz/generated/policy-artifact.wasm'
    );
    expect(String(state.get('/repo/functions/lib/authz/generated/policy-artifact.js'))).toContain(
      'export const POLICY_METADATA'
    );
  });

  it('throws when bundle extraction fails', () => {
    expect(() =>
      extractBundle({
        bundlePath: '/repo/policy/dist/authz-bundle.tar.gz',
        distDir: '/repo/policy/dist',
        spawnSyncImpl: vi.fn(() => ({ status: 1 })),
      })
    ).toThrow('failed to extract OPA bundle');
  });

  it('runs the compile workflow end to end', () => {
    const fsModule = {
      mkdirSync: vi.fn(),
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => []),
      rmSync: vi.fn(),
      readFileSync: vi.fn((target) =>
        target.endsWith('data.json') ? JSON.stringify({ ok: true }) : JSON.stringify({ version: 1 })
      ),
      copyFileSync: vi.fn(),
      writeFileSync: vi.fn(),
    };
    const runOpaImpl = vi.fn();
    const spawnSyncImpl = vi.fn(() => ({ status: 0 }));
    const consoleImpl = { log: vi.fn() };

    const runner = createCompileOpaRunner({
      root: '/repo',
      fsModule,
      spawnSyncImpl,
      runOpaImpl,
      consoleImpl,
      pathModule: {
        join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
      },
    });

    const result = runner.main();

    expect(runOpaImpl).toHaveBeenCalledWith([
      'build',
      '-t',
      'wasm',
      '-e',
      'kk/authz/decision',
      'policy/authz.rego',
      '-o',
      '/repo/policy/dist/authz-bundle.tar.gz',
    ]);
    expect(spawnSyncImpl).toHaveBeenCalled();
    expect(result.generatedArtifact).toBe('/repo/functions/lib/authz/generated/policy-artifact.js');
    expect(consoleImpl.log).toHaveBeenCalledTimes(3);
  });
});
