import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'storage', 'index.js');

describe('storage index dead exports audit', () => {
  it('keeps unused helper exports out of storage index', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function getProviderForFile(')) {
      offenders.push('functions/storage/index.js: still defines getProviderForFile');
    }

    if (source.includes('export function listAvailableProviders(')) {
      offenders.push('functions/storage/index.js: still defines listAvailableProviders');
    }

    if (source.includes('export function clearProviderCache(')) {
      offenders.push('functions/storage/index.js: still defines clearProviderCache');
    }

    expect(offenders, `storage index dead-export offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
