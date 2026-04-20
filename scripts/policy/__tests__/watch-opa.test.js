import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createWatchOpaRunner, runWatchOpaCli } from '../watch-opa.mjs';

describe('watch-opa runner', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(process.cwd(), '.tmp-watch-opa-'));
    fs.mkdirSync(path.join(tmpRoot, 'policy', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'policy', 'demo.rego'), 'package demo', 'utf8');
    fs.writeFileSync(path.join(tmpRoot, 'policy', 'nested', 'demo.json'), '{}', 'utf8');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('normalizes paths and filters policy files', () => {
    const runner = createWatchOpaRunner({ root: tmpRoot, processObj: { cwd: () => tmpRoot, argv: [], execPath: process.execPath } });

    expect(runner.normalizePath(path.join(tmpRoot, 'policy', 'demo.rego'))).toContain('/policy/demo.rego');
    expect(runner.shouldCompileFor(path.join(tmpRoot, 'policy', 'demo.rego'))).toBe(true);
    expect(runner.shouldCompileFor(path.join(tmpRoot, 'policy', 'dist', 'demo.rego'))).toBe(false);
    expect(runner.shouldCompileFor(path.join(tmpRoot, 'policy', 'nested', 'demo.json'))).toBe(true);
  });

  it('runs compile once and returns the exit code', async () => {
    const exitCodes = [0];
    const spawnImpl = vi.fn(() => ({
      on(event, handler) {
        if (event === 'exit') {
          queueMicrotask(() => handler(exitCodes.shift() ?? 0));
        }
        return this;
      },
    }));

    const runner = createWatchOpaRunner({
      root: tmpRoot,
      spawnImpl,
      processObj: { cwd: () => tmpRoot, argv: ['--once'], execPath: process.execPath },
      logger: { log: vi.fn(), error: vi.fn() },
    });

    await expect(runner.main()).resolves.toBe(0);
    expect(spawnImpl).toHaveBeenCalled();
  });

  it('debounces file changes and queues a second compile while the first is running', async () => {
    const exitCodes = [0, 0];
    const spawnImpl = vi.fn(() => ({
      on(event, handler) {
        if (event === 'exit') {
          queueMicrotask(() => handler(exitCodes.shift() ?? 0));
        }
        return this;
      },
    }));
    const logger = { log: vi.fn(), error: vi.fn() };
    const runner = createWatchOpaRunner({
      root: tmpRoot,
      spawnImpl,
      processObj: { cwd: () => tmpRoot, argv: [], execPath: process.execPath },
      logger,
      setTimeoutImpl: setTimeout,
      clearTimeoutImpl: clearTimeout,
    });

    const first = runner.triggerCompile();
    runner.scheduleCompile(`changed ${path.join(tmpRoot, 'policy', 'demo.rego')}`);
    vi.advanceTimersByTime(300);
    await first;
    await vi.runAllTimersAsync();

    expect(spawnImpl).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('compile success'));
  });

  it('falls back to recursive directory walking when recursive watch is unavailable', () => {
    const watchers = [];
    const fsModule = {
      existsSync: vi.fn(() => true),
      watch: vi.fn(() => {
        throw new Error('recursive not supported');
      }),
      readdirSync: vi.fn((dir) => {
        if (dir.endsWith('policy')) {
          return [
            { name: 'nested', isDirectory: () => true },
            { name: 'dist', isDirectory: () => true },
            { name: 'demo.rego', isDirectory: () => false },
          ];
        }
        return [{ name: 'demo.json', isDirectory: () => false }];
      }),
    };
    fsModule.watch.mockImplementation((dir, handler) => {
      watchers.push({ dir, handler });
      return { on: vi.fn() };
    });

    const runner = createWatchOpaRunner({
      root: tmpRoot,
      fsModule,
      processObj: { cwd: () => tmpRoot, argv: [], execPath: process.execPath },
      logger: { log: vi.fn(), error: vi.fn() },
    });

    runner.watchPolicyTree();
    expect(fsModule.watch).toHaveBeenCalled();
    expect(watchers.length).toBeGreaterThan(0);
  });

  it('returns a non-zero exit code when the policy directory is missing', async () => {
    const exitImpl = vi.fn();
    const runner = createWatchOpaRunner({
      root: tmpRoot,
      fsModule: {
        existsSync: vi.fn(() => false),
        watch: vi.fn(),
        readdirSync: vi.fn(),
      },
      processObj: { cwd: () => tmpRoot, argv: [], execPath: process.execPath },
      exitImpl,
      logger: { log: vi.fn(), error: vi.fn() },
    });

    runner.watchPolicyTree();
    expect(exitImpl).toHaveBeenCalledWith(1);
  });
});

describe('watch-opa cli export', () => {
  it('returns the compile exit code in once mode', async () => {
    const spawnImpl = vi.fn(() => ({
      on(event, handler) {
        if (event === 'exit') {
          queueMicrotask(() => handler(0));
        }
        return this;
      },
    }));

    await expect(runWatchOpaCli({
      root: process.cwd(),
      once: true,
      processObj: { cwd: () => process.cwd(), argv: ['--once'], execPath: process.execPath },
      spawnImpl,
      logger: { log: vi.fn(), error: vi.fn() },
    })).resolves.toBe(0);
  });
});
