import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = '/home/bjw/Code/KK-Image/functions/lib/hono/routes';
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
        offenders.push(path.relative('/home/bjw/Code/KK-Image', file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
