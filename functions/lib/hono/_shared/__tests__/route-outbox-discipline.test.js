import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

// 从测试文件位置推导 routes 根目录，避免硬编码绝对路径（在其它机器上 ENOENT）
const ROUTES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../routes'
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const IGNORED_DIRS = new Set(['__tests__']);

function walkRouteFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkRouteFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe('route outbox discipline guard', () => {
  it('does not call invalidateCache directly from route modules', () => {
    const offenders = [];

    for (const file of walkRouteFiles(ROUTES_DIR)) {
      const source = fs.readFileSync(file, 'utf8');
      if (source.includes('invalidateCache(')) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
