#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import waitOn from 'wait-on';

function createWaitResource(baseUrl) {
  const healthUrl = new URL('/api/v1/health', baseUrl);
  return `http-get://${healthUrl.host}${healthUrl.pathname}`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
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

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;

  child.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
    }
  }, 5000);

  try {
    await once(child, 'exit');
  } finally {
    clearTimeout(killTimer);
  }
}

async function main() {
  const baseUrl = process.env.DEPLOY_URL || 'http://localhost:8080';
  const waitResource = process.env.DEPLOY_VERIFY_WAIT_ON || createWaitResource(baseUrl);
  let serverProcess = null;

  const shutdown = async (exitCode = 0) => {
    await stopChild(serverProcess);
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    shutdown(130).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });
  process.on('SIGTERM', () => {
    shutdown(143).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });

  try {
    await runCommand('pnpm', ['build']);

    serverProcess = spawn('pnpm', ['start'], {
      stdio: 'inherit',
      env: process.env,
    });

    serverProcess.on('error', (error) => {
      console.error(error);
    });

    await waitOn({
      resources: [waitResource],
      timeout: 30000,
      interval: 500,
      tcpTimeout: 1000,
    });

    await runCommand('pnpm', ['deploy:check']);
    await shutdown(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await shutdown(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
