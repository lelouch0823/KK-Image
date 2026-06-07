import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'storage', 'router.js');

describe('storage router thin wrappers audit', () => {
  it('keeps getFallbackTimeout out of storage router helpers', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function getFallbackTimeout(')) {
      offenders.push('functions/storage/router.js: still defines getFallbackTimeout');
    }

    if (source.includes('export function isFallbackEnabled(')) {
      offenders.push('functions/storage/router.js: still defines isFallbackEnabled');
    }

    expect(offenders, `storage router thin-wrapper offenders:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
