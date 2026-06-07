import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TOP_LEVEL_UTILS = path.join(ROOT, 'functions', '_shared', 'utils.js');
const WRAPPER_FILES = [
  path.join(ROOT, 'functions', 'lib', '_shared', 'utils.js'),
  path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'utils.js'),
];

function collectJavaScriptFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('shared utils barrel dedup audit', () => {
  it('makes lib modules import the top-level shared utils directly', () => {
    const offenders = [];
    const libRoot = path.join(ROOT, 'functions', 'lib');
    const staticImportPattern = /from ['"]([^'"]*_shared\/utils\.js)['"]/g;
    const dynamicImportPattern = /import\(['"]([^'"]*_shared\/utils\.js)['"]\)/g;

    for (const wrapperPath of WRAPPER_FILES) {
      if (fs.existsSync(wrapperPath)) {
        offenders.push(`${path.relative(ROOT, wrapperPath)}: wrapper barrel should be removed`);
      }
    }

    for (const filePath of collectJavaScriptFiles(libRoot)) {
      const source = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(ROOT, filePath);
      for (const pattern of [staticImportPattern, dynamicImportPattern]) {
        let match = pattern.exec(source);

        while (match) {
          const resolved = path.normalize(path.resolve(path.dirname(filePath), match[1]));
          if (resolved !== TOP_LEVEL_UTILS) {
            offenders.push(
              `${relativePath}: ${match[1]} does not resolve to functions/_shared/utils.js`
            );
          }
          match = pattern.exec(source);
        }
      }
    }

    expect(offenders, `shared utils dedup offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
