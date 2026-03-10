import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walkJsFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) out.push(fullPath);
  }
  return out;
}

function collectLegacyShortagePaths() {
  const root = process.cwd();
  const files = walkJsFiles(path.resolve(root, 'functions'));
  const forbiddenPatterns = [
    /COALESCE\(SUM\(o\.quantity\),\s*0\)\s*-\s*COALESCE\(MAX\(pv\.stock_quantity\),\s*0\)\s+as\s+shortage/i,
    /calculateInventoryShortage\s*\(/i,
  ];
  const allowedSuffixes = new Set([
    path.join('functions', 'services', 'DemandService.js'),
  ]);

  return files.flatMap((file) => {
    const relativePath = path.relative(root, file);
    if (allowedSuffixes.has(relativePath)) return [];

    const content = fs.readFileSync(file, 'utf8');
    const matches = forbiddenPatterns.some((pattern) => pattern.test(content));
    return matches ? [relativePath] : [];
  });
}

describe('legacy shortage calculation paths', () => {
  it('does not leave ad hoc shortage math outside approved demand boundaries', () => {
    const offenders = collectLegacyShortagePaths();

    expect(
      offenders,
      `legacy shortage paths still present:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
