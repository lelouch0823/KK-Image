import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'auth-helpers.js');

describe('auth helpers thin wrappers audit', () => {
  it('keeps getLockedMessage out of shared auth helpers', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function getLockedMessage(')) {
      offenders.push('functions/lib/hono/_shared/auth-helpers.js: still defines getLockedMessage');
    }

    expect(offenders, `auth helpers thin-wrapper offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
