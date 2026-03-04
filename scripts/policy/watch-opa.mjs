#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const policyDir = path.join(root, 'policy');
const compileScript = path.join(root, 'scripts', 'policy', 'compile-opa.mjs');
const once = process.argv.includes('--once');
const debounceMs = 250;

let pending = false;
let building = false;
let timer = null;
let lastReason = 'initial';

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldCompileFor(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(normalizePath(policyDir))) return false;
  if (normalized.includes('/policy/dist/')) return false;
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.rego' || ext === '.json';
}

function runCompile() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [compileScript], {
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
  console.log(`[authz][watch] compiling policy (${reason})...`);

  const code = await runCompile();
  const duration = Date.now() - startedAt;

  if (code === 0) {
    console.log(`[authz][watch] compile success in ${duration}ms`);
    console.log('[authz][watch] if wrangler is already running, restart it to pick up new policy artifact');
  } else {
    console.error(`[authz][watch] compile failed with exit code ${code}`);
  }

  building = false;
  if (pending) {
    pending = false;
    await triggerCompile();
  }
}

function scheduleCompile(reason) {
  lastReason = reason;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void triggerCompile();
  }, debounceMs);
}

function watchPolicyTree() {
  if (!fs.existsSync(policyDir)) {
    console.error(`[authz][watch] policy directory not found: ${policyDir}`);
    process.exit(1);
  }

  try {
    const watcher = fs.watch(policyDir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const fullPath = path.join(policyDir, filename.toString());
      if (!shouldCompileFor(fullPath)) return;
      scheduleCompile(`changed ${normalizePath(fullPath)}`);
    });
    watcher.on('error', (err) => {
      console.error('[authz][watch] watcher error:', err.message);
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
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'dist') continue;
      if (entry.isDirectory()) {
        stack.push(path.join(dir, entry.name));
      }
    }
  }

  for (const dir of dirs) {
    const watcher = fs.watch(dir, (_event, filename) => {
      if (!filename) return;
      const fullPath = path.join(dir, filename.toString());
      if (!shouldCompileFor(fullPath)) return;
      scheduleCompile(`changed ${normalizePath(fullPath)}`);
    });
    watcher.on('error', (err) => {
      console.error(`[authz][watch] watcher error (${normalizePath(dir)}):`, err.message);
    });
  }
}

async function main() {
  if (once) {
    const code = await runCompile();
    process.exit(code);
  }

  console.log(`[authz][watch] watching ${policyDir}`);
  watchPolicyTree();
  await triggerCompile();
}

main();
