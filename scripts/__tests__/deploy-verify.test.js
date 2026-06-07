import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createWaitResource, main, runCommand, stopChild } from '../deploy-verify.mjs';

function createChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  child.kill = vi.fn((signal) => {
    child.killed = true;
    child.lastSignal = signal;
  });
  return child;
}

describe('deploy-verify', () => {
  it('builds the health wait-on resource from the base url', () => {
    expect(createWaitResource('http://127.0.0.1:8080/admin')).toBe(
      'http-get://127.0.0.1:8080/api/v1/health'
    );
  });

  it('runs commands successfully and reports exit failures', async () => {
    const successChild = createChild();
    const spawnSuccess = vi.fn(() => {
      queueMicrotask(() => successChild.emit('exit', 0, null));
      return successChild;
    });

    await expect(
      runCommand('pnpm', ['build'], {}, { spawnImpl: spawnSuccess, env: { FOO: 'bar' } })
    ).resolves.toBeUndefined();
    expect(spawnSuccess).toHaveBeenCalledWith(
      'pnpm',
      ['build'],
      expect.objectContaining({
        stdio: 'inherit',
        env: { FOO: 'bar' },
      })
    );

    const failChild = createChild();
    const spawnFail = vi.fn(() => {
      queueMicrotask(() => failChild.emit('exit', 1, null));
      return failChild;
    });
    await expect(runCommand('pnpm', ['build'], {}, { spawnImpl: spawnFail })).rejects.toThrow(
      'pnpm build failed with exit code 1'
    );

    const signalChild = createChild();
    const spawnSignal = vi.fn(() => {
      queueMicrotask(() => signalChild.emit('exit', null, 'SIGTERM'));
      return signalChild;
    });
    await expect(runCommand('pnpm', ['build'], {}, { spawnImpl: spawnSignal })).rejects.toThrow(
      'pnpm build exited via signal SIGTERM'
    );
  });

  it('stops child processes gracefully and escalates only when needed', async () => {
    const child = createChild();
    const onceImpl = vi.fn(() => Promise.resolve(['exit']));
    const clearTimeoutImpl = vi.fn();
    const setTimeoutImpl = vi.fn(() => 7);

    await stopChild(child, { onceImpl, setTimeoutImpl, clearTimeoutImpl });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(clearTimeoutImpl).toHaveBeenCalledWith(7);

    const alreadyExited = createChild();
    alreadyExited.exitCode = 0;
    await expect(stopChild(alreadyExited)).resolves.toBeUndefined();
    expect(alreadyExited.kill).not.toHaveBeenCalled();
  });

  it('runs the deploy verification workflow end to end on success', async () => {
    const processImpl = {
      on: vi.fn(),
      exit: vi.fn(),
    };
    const runCommandImpl = vi.fn(async () => undefined);
    const stopChildImpl = vi.fn(async () => undefined);
    const waitOnImpl = vi.fn(async () => undefined);
    const consoleImpl = { error: vi.fn() };
    const serverProcess = createChild();
    const spawnImpl = vi.fn((_command, args) => {
      if (args[0] === 'start') return serverProcess;
      throw new Error(`unexpected spawn ${args.join(' ')}`);
    });

    await main({
      env: { DEPLOY_URL: 'http://127.0.0.1:9000' },
      processImpl,
      consoleImpl,
      spawnImpl,
      waitOnImpl,
      runCommandImpl,
      stopChildImpl,
    });

    expect(runCommandImpl).toHaveBeenNthCalledWith(
      1,
      'pnpm',
      ['build'],
      {},
      expect.objectContaining({ spawnImpl, env: { DEPLOY_URL: 'http://127.0.0.1:9000' } })
    );
    expect(waitOnImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: ['http-get://127.0.0.1:9000/api/v1/health'],
      })
    );
    expect(runCommandImpl).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['deploy:check'],
      {},
      expect.objectContaining({ spawnImpl, env: { DEPLOY_URL: 'http://127.0.0.1:9000' } })
    );
    expect(stopChildImpl).toHaveBeenCalledWith(serverProcess);
    expect(processImpl.exit).toHaveBeenCalledWith(0);
  });

  it('shuts down with exit code 1 when the workflow fails', async () => {
    const processImpl = {
      on: vi.fn(),
      exit: vi.fn(),
    };
    const runCommandImpl = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('deploy check failed'));
    const stopChildImpl = vi.fn(async () => undefined);
    const waitOnImpl = vi.fn(async () => undefined);
    const consoleImpl = { error: vi.fn() };
    const serverProcess = createChild();
    const spawnImpl = vi.fn(() => serverProcess);

    await main({
      env: {},
      processImpl,
      consoleImpl,
      spawnImpl,
      waitOnImpl,
      runCommandImpl,
      stopChildImpl,
    });

    expect(consoleImpl.error).toHaveBeenCalledWith('deploy check failed');
    expect(stopChildImpl).toHaveBeenCalledWith(serverProcess);
    expect(processImpl.exit).toHaveBeenCalledWith(1);
  });
});
