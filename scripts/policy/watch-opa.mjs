#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function createWatchOpaRunner(options = {}) {
  const processObj = options.processObj || process;
  const fsModule = options.fsModule || fs;
  const pathModule = options.pathModule || path;
  const spawnImpl = options.spawnImpl || spawn;
  const logger = options.logger || console;
  const setTimeoutImpl = options.setTimeoutImpl || setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl || clearTimeout;
  const root = options.root || processObj.cwd();
  const policyDir = options.policyDir || pathModule.join(root, 'policy');
  const compileScript =
    options.compileScript || pathModule.join(root, 'scripts', 'policy', 'compile-opa.mjs');
  const once = options.once ?? processObj.argv.includes('--once');
  const debounceMs = options.debounceMs ?? 250;
  const exitImpl = options.exitImpl || ((code) => processObj.exit(code));

  let pending = false;
  let building = false;
  let timer = null;
  let lastReason = 'initial';

  function normalizePath(filePath) {
    return filePath.split(pathModule.sep).join('/');
  }

  function shouldCompileFor(filePath) {
    const normalized = normalizePath(filePath);
    if (!normalized.startsWith(normalizePath(policyDir))) return false;
    if (normalized.includes('/policy/dist/')) return false;
    const ext = pathModule.extname(filePath).toLowerCase();
    return ext === '.rego' || ext === '.json';
  }

  function runCompile() {
    return new Promise((resolve) => {
      const child = spawnImpl(processObj.execPath, [compileScript], {
        stdio: 'inherit',
        shell: false,
      });
      child.on('exit', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });
  }

  async function triggerCompile() {
    if (building) {
      pending = true;
      return;
    }

    building = true;
    const reason = lastReason;
    const startedAt = Date.now();
    logger.log(`[authz][watch] compiling policy (${reason})...`);

    const code = await runCompile();
    const duration = Date.now() - startedAt;

    if (code === 0) {
      logger.log(`[authz][watch] compile success in ${duration}ms`);
      logger.log(
        '[authz][watch] if wrangler is already running, restart it to pick up new policy artifact'
      );
    } else {
      logger.error(`[authz][watch] compile failed with exit code ${code}`);
    }

    building = false;
    if (pending) {
      pending = false;
      await triggerCompile();
    }
  }

  function scheduleCompile(reason) {
    lastReason = reason;
    if (timer) clearTimeoutImpl(timer);
    timer = setTimeoutImpl(() => {
      timer = null;
      void triggerCompile();
    }, debounceMs);
  }

  function watchPolicyTree() {
    if (!fsModule.existsSync(policyDir)) {
      logger.error(`[authz][watch] policy directory not found: ${policyDir}`);
      exitImpl(1);
      return;
    }

    try {
      const watcher = fsModule.watch(policyDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const fullPath = pathModule.join(policyDir, filename.toString());
        if (!shouldCompileFor(fullPath)) return;
        scheduleCompile(`changed ${normalizePath(fullPath)}`);
      });
      watcher.on('error', (err) => {
        logger.error('[authz][watch] watcher error:', err.message);
      });
      return;
    } catch (_err) {
      // Fallback for environments without recursive watch support.
    }

    const dirs = [];
    const stack = [policyDir];
    while (stack.length > 0) {
      const dir = stack.pop();
      dirs.push(dir);
      const entries = fsModule.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'dist') continue;
        if (entry.isDirectory()) {
          stack.push(pathModule.join(dir, entry.name));
        }
      }
    }

    for (const dir of dirs) {
      const watcher = fsModule.watch(dir, (_event, filename) => {
        if (!filename) return;
        const fullPath = pathModule.join(dir, filename.toString());
        if (!shouldCompileFor(fullPath)) return;
        scheduleCompile(`changed ${normalizePath(fullPath)}`);
      });
      watcher.on('error', (err) => {
        logger.error(`[authz][watch] watcher error (${normalizePath(dir)}):`, err.message);
      });
    }
  }

  async function main() {
    if (once) {
      return runCompile();
    }

    logger.log(`[authz][watch] watching ${policyDir}`);
    watchPolicyTree();
    await triggerCompile();
    return 0;
  }

  return {
    normalizePath,
    shouldCompileFor,
    runCompile,
    triggerCompile,
    scheduleCompile,
    watchPolicyTree,
    main,
    getState: () => ({ pending, building, timer, lastReason, policyDir, compileScript, once }),
  };
}

export async function runWatchOpaCli(options = {}) {
  const runner = createWatchOpaRunner(options);
  return runner.main();
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const exitCode = await runWatchOpaCli();
  process.exit(exitCode);
}
