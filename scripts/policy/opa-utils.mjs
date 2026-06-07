import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

const toAbs = (p) => path.resolve(ROOT, p);

export function resolveOpaBin() {
  const candidates = [
    process.env.OPA_BIN,
    process.platform === 'win32' ? toAbs('scripts/bin/opa.exe') : null,
    process.platform !== 'win32' ? toAbs('scripts/bin/opa') : null,
    'opa',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'opa') return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'opa';
}

export function runOpa(args, options = {}) {
  const opaBin = resolveOpaBin();
  const result = spawnSync(opaBin, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`OPA command failed with code ${result.status}: ${opaBin} ${args.join(' ')}`);
  }
}
