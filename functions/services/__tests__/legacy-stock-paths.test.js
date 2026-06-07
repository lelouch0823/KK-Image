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

function collectDirectStockWritePaths() {
  const root = process.cwd();
  const files = walkJsFiles(path.resolve(root, 'functions'));
  const forbiddenPatterns = [
    /UPDATE\s+product_variants[\s\S]*?SET\s+stock_quantity\s*=/i,
    /stock_quantity\s*=\s*MAX\(0,\s*stock_quantity\s*\+/i,
  ];
  const allowedSuffixes = new Set([path.join('functions', 'services', 'InventoryService.js')]);

  return files.flatMap((file) => {
    const relativePath = path.relative(root, file);
    if (allowedSuffixes.has(relativePath)) return [];

    const content = fs.readFileSync(file, 'utf8');
    const matches = forbiddenPatterns.some((pattern) => pattern.test(content));
    return matches ? [relativePath] : [];
  });
}

describe('legacy stock mutation paths', () => {
  it('does not leave direct business stock writes outside InventoryService internals', () => {
    const offenders = collectDirectStockWritePaths();

    expect(
      offenders,
      `legacy direct stock write paths still present:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
