import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'api', 'utils', 'folder-utils.js');

describe('folder utils thin wrappers audit', () => {
  it('keeps ensureSystemRoot out of folder-utils module', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export async function ensureSystemRoot(')) {
      offenders.push('functions/api/utils/folder-utils.js: still defines ensureSystemRoot');
    }

    expect(
      offenders,
      `folder utils thin-wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
