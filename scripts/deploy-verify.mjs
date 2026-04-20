#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import waitOn from 'wait-on';

export function createWaitResource(baseUrl) {
  const healthUrl = new URL('/api/v1/health', baseUrl);
  return `http-get://${healthUrl.host}${healthUrl.pathname}`;
}

export function runCommand(command, args, options = {}, { spawnImpl = spawn, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      stdio: 'inherit',
      env,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited via signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
        return;
      }
      resolve();
    });
  });
}

export async function stopChild(child, { onceImpl = once, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  if (!child || child.exitCode !== null || child.killed) return;

  child.kill('SIGTERM');
  const killTimer = setTimeoutImpl(() => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
    }
  }, 5000);

  try {
    await onceImpl(child, 'exit');
  } finally {
    clearTimeoutImpl(killTimer);
  }
}

export async function main({
  env = process.env,
  processImpl = process,
  consoleImpl = console,
  spawnImpl = spawn,
  waitOnImpl = waitOn,
  runCommandImpl = runCommand,
  stopChildImpl = stopChild,
} = {}) {
  const baseUrl = env.DEPLOY_URL || 'http://localhost:8080';
  const waitResource = env.DEPLOY_VERIFY_WAIT_ON || createWaitResource(baseUrl);
  let serverProcess = null;

  const shutdown = async (exitCode = 0) => {
    await stopChildImpl(serverProcess);
    processImpl.exit(exitCode);
  };

  processImpl.on('SIGINT', () => {
    shutdown(130).catch((error) => {
      consoleImpl.error(error);
      processImpl.exit(1);
    });
  });
  processImpl.on('SIGTERM', () => {
    shutdown(143).catch((error) => {
      consoleImpl.error(error);
      processImpl.exit(1);
    });
  });

  try {
    await runCommandImpl('pnpm', ['build'], {}, { spawnImpl, env });

    serverProcess = spawnImpl('pnpm', ['start'], {
      stdio: 'inherit',
      env,
    });

    serverProcess.on('error', (error) => {
      consoleImpl.error(error);
    });

    await waitOnImpl({
      resources: [waitResource],
      timeout: 30000,
      interval: 500,
      tcpTimeout: 1000,
    });

    await runCommandImpl('pnpm', ['deploy:check'], {}, { spawnImpl, env });
    await shutdown(0);
  } catch (error) {
    consoleImpl.error(error instanceof Error ? error.message : error);
    await shutdown(1);
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
